import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { getAuthenticatedUserForPasswordChange, getSessionCookieName } from '@/lib/auth/session';
import { logSafeAuthError } from '@/lib/admin/lifecycle-validation';

function passwordChangedResponse(body: Record<string, unknown>, statusCode: number) {
  const response = NextResponse.json(
    {
      ...body,
      passwordChanged: true,
    },
    {
      status: statusCode,
      headers: { 'Cache-Control': 'no-store' },
    }
  );

  response.cookies.set(getSessionCookieName(), '', {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });

  return response;
}
export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };

  try {
    // 1. Cross-origin / CSRF validation
    const origin = request.headers.get('origin');
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json(
            { error: 'Forbidden: Cross-origin request rejected.' },
            { status: 403, headers }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Forbidden: Invalid request origin.' },
          { status: 403, headers }
        );
      }
    }

    // 2. Parse request payload without logging sensitive fields
    const body = await request.json().catch(() => ({}));
    const { currentPassword, newPassword } = body as { currentPassword?: string; newPassword?: string };

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json(
        { error: 'Current password is required.' },
        { status: 400, headers }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long.' },
        { status: 400, headers }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from your current temporary password.' },
        { status: 400, headers }
      );
    }

    // 3. Verify HTTP-only session
    let authUserResult;
    try {
      authUserResult = await getAuthenticatedUserForPasswordChange();
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized: Session is invalid or expired. Please sign in again.' },
        { status: 401, headers }
      );
    }

    const { uid, user } = authUserResult;

    // 4. Require mustChangePassword === true
    if (user.mustChangePassword !== true) {
      return NextResponse.json(
        { error: 'Mandatory password change is not required for this account.' },
        { status: 400, headers }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'User profile does not contain a valid email address.' },
        { status: 400, headers }
      );
    }

    // 5. Server-side reauthentication with current password using Firebase Identity Toolkit
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'fake-api-key';
    const emulatorHost =
      process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' ? '127.0.0.1:9099' : null);

    let identityEndpoint: string;
    if (emulatorHost) {
      const hostUrl = emulatorHost.includes('://') ? emulatorHost : `http://${emulatorHost}`;
      identityEndpoint = `${hostUrl}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    } else {
      identityEndpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    }

    const reauthResponse = await fetch(identityEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: currentPassword,
        returnSecureToken: true,
      }),
    });

    if (!reauthResponse.ok) {
      return NextResponse.json(
        { error: 'Current password verification failed. Please check your current temporary password.' },
        { status: 400, headers }
      );
    }

    const reauthData = (await reauthResponse.json()) as { localId?: string };
    if (reauthData.localId !== uid) {
      return NextResponse.json(
        { error: 'Authenticated account identity mismatch.' },
        { status: 403, headers }
      );
    }

    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    // Read & preserve existing custom claims before mutation
    const authRecord = await auth.getUser(uid);
    const previousClaims = authRecord.customClaims || {};

    // Step 1. Update Firebase Auth password
    try {
      await auth.updateUser(uid, { password: newPassword });
    } catch (passErr: unknown) {
      const msg = passErr instanceof Error ? passErr.message : 'Password update failed.';
      console.error('Auth password update failed during change-password:', msg);
      return NextResponse.json(
        { error: 'Failed to update authentication password. Please try again.' },
        { status: 400, headers }
      );
    }

    const HTTP_OK = 200;
    const BAD_REQUEST = 400;
    const SERVER_ERROR = 500;

    // Step 2. Revoke refresh tokens
    try {
      await auth.revokeRefreshTokens(uid);
    } catch (tokenErr: unknown) {
      const msg = tokenErr instanceof Error ? tokenErr.message : 'Unknown error';
      console.error('Session token revocation failed during change-password:', msg);
      return passwordChangedResponse(
        {
          error:
            'The password changed, but session revocation did not complete. Sign in with the new password and retry the mandatory password-change process.',
        },
        BAD_REQUEST
      );
    }

    // Step 3. Set custom claims to mustChangePassword: false preserving existing claims
    try {
      await auth.setCustomUserClaims(uid, {
        ...previousClaims,
        role: user.role,
        mustChangePassword: false,
      });
    } catch (claimErr: unknown) {
      const msg = claimErr instanceof Error ? claimErr.message : 'Unknown error';
      console.error('Custom claim update failed during change-password:', msg);
      return passwordChangedResponse(
        {
          error:
            'The password changed, but mandatory-change completion remains pending. Sign in with your new password to retry mandatory password change.',
        },
        BAD_REQUEST
      );
    }

    // Step 4. Write Firestore profile flag & Activity Log in ONE atomic batch
    const now = new Date().toISOString();
    try {
      const batch = firestore.batch();
      const userRef = firestore.collection('users').doc(uid);
      batch.update(userRef, {
        mustChangePassword: false,
        updatedAt: now,
      });

      const logRef = firestore.collection('activityLogs').doc();
      batch.set(logRef, {
        actorId: uid,
        actorName: user.fullName || 'User',
        actorRole: user.role || 'user',
        action: 'complete_mandatory_password_change',
        entityType: 'user',
        entityId: uid,
        metadata: {},
        createdAt: now,
      });

      await batch.commit();
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : 'Unknown error';
      console.error('Firestore batch write failed during change-password:', msg);

      // Attempt rollback of custom claim to mustChangePassword: true
      let rollbackSucceeded = false;
      try {
        await auth.setCustomUserClaims(uid, {
          ...previousClaims,
          role: user.role,
          mustChangePassword: true,
        });
        rollbackSucceeded = true;
      } catch {}

      if (rollbackSucceeded) {
        return passwordChangedResponse(
          {
            error:
              'Password changed and claims restored to mandatory-change-required state, but profile update failed. Sign in with your new password to retry.',
          },
          BAD_REQUEST
        );
      }

      // Explicit disable tracking if state synchronization & claim rollback both fail
      let accountDisabled = false;
      try {
        await auth.updateUser(uid, { disabled: true });
        accountDisabled = true;
      } catch (disableErr: unknown) {
        const dMsg = disableErr instanceof Error ? disableErr.message : 'Unknown error';
        console.error('Account disable fallback failed:', dMsg);
      }

      const errorMsg = accountDisabled
        ? 'Password changed, but account synchronization failed. The account was disabled for security. Contact an administrator.'
        : 'Password changed, account synchronization failed, and the account could not be disabled automatically. Immediate administrator intervention is required.';

      return passwordChangedResponse(
        {
          error: errorMsg,
          accountDisabled,
          manualInterventionRequired: true,
        },
        accountDisabled ? BAD_REQUEST : SERVER_ERROR
      );
    }

    // Step 5. Clear session cookie & return success response
    return passwordChangedResponse(
      {
        success: true,
        message: 'Password updated successfully. Redirecting to sign in...',
      },
      HTTP_OK
    );
  } catch (error: unknown) {
    logSafeAuthError('change_password_route', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while changing your password.' },
      { status: 500, headers }
    );
  }
}
