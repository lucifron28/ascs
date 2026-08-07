import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { getAuthenticatedUserForPasswordChange, getSessionCookieName } from '@/lib/auth/session';

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

    // 6. Update Firebase Auth password
    await auth.updateUser(uid, { password: newPassword });

    // 7. Preserve existing custom claims while setting mustChangePassword: false
    const authRecord = await auth.getUser(uid);
    const previousClaims = authRecord.customClaims || {};
    await auth.setCustomUserClaims(uid, {
      ...previousClaims,
      role: user.role,
      mustChangePassword: false,
    });

    // 8. Update Firestore profile
    const now = new Date().toISOString();
    await firestore.collection('users').doc(uid).update({
      mustChangePassword: false,
      updatedAt: now,
    });

    // 9. Write Activity Log
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
      actorId: uid,
      actorName: user.fullName || 'User',
      actorRole: user.role || 'user',
      action: 'complete_mandatory_password_change',
      entityType: 'user',
      entityId: uid,
      metadata: {},
      createdAt: now,
    });

    // 10. Revoke refresh tokens
    await auth.revokeRefreshTokens(uid);

    // 11. Clear session cookie & require fresh login
    const response = NextResponse.json(
      {
        success: true,
        message: 'Password updated successfully. Please sign in again using your new password.',
      },
      { status: 200, headers }
    );

    response.cookies.set(getSessionCookieName(), '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process password change.';
    console.error('Password change handler error:', message);
    return NextResponse.json(
      { error: 'An unexpected error occurred while changing your password.' },
      { status: 500, headers }
    );
  }
}
