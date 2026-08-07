'use server';

import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { UserRole } from '@/lib/types/roles';
import {
  StudentAccountInput,
  StaffAccountInput,
  validateStudentInput,
  validateStaffInput,
  validateTemporaryPassword,
  checkSelfOperation,
  checkFinalActiveAdmin,
  generateRandomTemporaryPassword,
  sanitizeAuditMetadata,
  mapLifecycleError,
  logSafeAuthError,
} from '@/lib/admin/lifecycle-validation';
// Helper to verify caller is active Admin
async function getAuthenticatedAdmin() {
  const authenticated = await getAuthenticatedUser();
  if (authenticated.user.role !== 'admin') {
    throw new Error('Unauthorized: Only system administrators can access account lifecycle operations.');
  }
  return authenticated;
}

// 1. Create Student Account
export async function createStudentAccountAction(data: StudentAccountInput) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    const input = validateStudentInput(data);

    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    // Duplicate email check in Auth
    try {
      await auth.getUserByEmail(input.email);
      throw new Error(`Email address '${input.email}' is already registered in Authentication.`);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      if (authErr.message?.includes('already registered')) {
        throw err;
      }
    }

    // Duplicate student number check in Firestore
    const studentNumberQuery = await firestore
      .collection('students')
      .where('studentNumber', '==', input.studentNumber)
      .get();

    if (!studentNumberQuery.empty) {
      throw new Error(`Student number '${input.studentNumber}' is already registered to another student.`);
    }

    const tempPassword = input.temporaryPassword || generateRandomTemporaryPassword();

    // Step A: Create Auth user & set custom claims with cleanup compensation
    let createdUid: string | null = null;
    try {
      const userRecord = await auth.createUser({
        email: input.email,
        password: tempPassword,
        displayName: input.fullName,
        emailVerified: true,
      });
      createdUid = userRecord.uid;
      await auth.setCustomUserClaims(createdUid, { role: 'student', mustChangePassword: true });
    } catch (authErr: unknown) {
      if (createdUid) {
        let deleted = false;
        try {
          await auth.deleteUser(createdUid);
          deleted = true;
        } catch {}
        if (!deleted) {
          throw new Error(
            'Account creation partially failed and Auth cleanup also failed. Manual intervention is required.'
          );
        }
        throw new Error(
          'Account creation failed during custom claim setup. Auth cleanup completed.'
        );
      }
      const msg = authErr instanceof Error ? authErr.message : 'Auth user creation failed.';
      throw new Error(`Failed to create authentication user: ${msg}`);
    }

    const uid = createdUid;

    // Step B: Write Firestore profiles & Activity Log in ONE atomic batch
    const now = new Date().toISOString();
    try {
      const batch = firestore.batch();

      const userRef = firestore.collection('users').doc(uid);
      batch.set(userRef, {
        uid,
        email: input.email,
        fullName: input.fullName,
        role: 'student',
        accountStatus: 'active',
        isActive: true,
        mustChangePassword: true,
        studentNumber: input.studentNumber,
        contactNumber: input.contactNumber,
        createdAt: now,
        updatedAt: now,
        createdBy: adminUid,
      });

      const publicRef = firestore.collection('publicUsers').doc(uid);
      batch.set(publicRef, {
        uid,
        email: input.email,
        fullName: input.fullName,
        role: 'student',
        accountStatus: 'active',
        isActive: true,
      });

      const studentRef = firestore.collection('students').doc(uid);
      batch.set(studentRef, {
        uid,
        studentNumber: input.studentNumber,
        fullName: input.fullName,
        email: input.email,
        program: input.program,
        yearLevel: input.yearLevel,
        section: input.section,
        contactNumber: input.contactNumber,
        createdAt: now,
        updatedAt: now,
      });

      const logRef = firestore.collection('activityLogs').doc();
      batch.set(logRef, {
        actorId: adminUid,
        actorName: adminUser.fullName || 'Administrator',
        actorRole: 'admin',
        action: 'create_student_account',
        entityType: 'user',
        entityId: uid,
        metadata: sanitizeAuditMetadata({
          email: input.email,
          studentNumber: input.studentNumber,
          program: input.program,
          role: 'student',
        }),
        createdAt: now,
      });

      await batch.commit();
    } catch (dbErr: unknown) {
      let deleted = false;
      try {
        await auth.deleteUser(uid);
        deleted = true;
      } catch {}
      const cleanupStatus = deleted ? 'Auth cleanup completed.' : 'Auth cleanup failed (manual intervention required).';
      const msg = dbErr instanceof Error ? dbErr.message : 'Database profile creation failed.';
      throw new Error(`Account creation failed during Firestore write: ${msg}. ${cleanupStatus}`);
    }

    return {
      success: true,
      temporaryPassword: tempPassword,
      user: {
        uid,
        email: input.email,
        fullName: input.fullName,
        role: 'student' as UserRole,
        studentNumber: input.studentNumber,
      },
    };
  } catch (error: unknown) {
    logSafeAuthError('create_student_account', error);
    return { success: false, error: mapLifecycleError(error, 'Failed to create student account.') };
  }
}

// 2. Create Staff Account
export async function createStaffAccountAction(
  data: StaffAccountInput & { confirmElevatedAdminCreation?: boolean }
) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    const input = validateStaffInput(data);

    if (input.role === 'admin' && data.confirmElevatedAdminCreation !== true) {
      throw new Error('Creating an administrator account requires explicit confirmation.');
    }

    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    // Duplicate email check in Auth
    try {
      await auth.getUserByEmail(input.email);
      throw new Error(`Email address '${input.email}' is already registered in Authentication.`);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      if (authErr.message?.includes('already registered')) {
        throw err;
      }
    }

    const tempPassword = input.temporaryPassword || generateRandomTemporaryPassword();

    // Step A: Create Auth user & set custom claims with compensation
    let createdUid: string | null = null;
    try {
      const userRecord = await auth.createUser({
        email: input.email,
        password: tempPassword,
        displayName: input.fullName,
        emailVerified: true,
      });
      createdUid = userRecord.uid;
      await auth.setCustomUserClaims(createdUid, { role: input.role, mustChangePassword: true });
    } catch (authErr: unknown) {
      if (createdUid) {
        let deleted = false;
        try {
          await auth.deleteUser(createdUid);
          deleted = true;
        } catch {}
        if (!deleted) {
          throw new Error(
            'Staff creation partially failed and Auth cleanup also failed. Manual intervention is required.'
          );
        }
        throw new Error(
          'Staff creation failed during custom claim setup. Auth cleanup completed.'
        );
      }
      const msg = authErr instanceof Error ? authErr.message : 'Auth staff creation failed.';
      throw new Error(`Failed to create staff authentication user: ${msg}`);
    }

    const uid = createdUid;

    // Step B: Write Firestore profiles & Activity Log in ONE atomic batch
    const now = new Date().toISOString();
    try {
      const batch = firestore.batch();

      const userRef = firestore.collection('users').doc(uid);
      batch.set(userRef, {
        uid,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        accountStatus: 'active',
        isActive: true,
        mustChangePassword: true,
        contactNumber: input.contactNumber,
        createdAt: now,
        updatedAt: now,
        createdBy: adminUid,
      });

      const publicRef = firestore.collection('publicUsers').doc(uid);
      batch.set(publicRef, {
        uid,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        accountStatus: 'active',
        isActive: true,
      });

      const logRef = firestore.collection('activityLogs').doc();
      batch.set(logRef, {
        actorId: adminUid,
        actorName: adminUser.fullName || 'Administrator',
        actorRole: 'admin',
        action: input.role === 'admin' ? 'create_admin_account' : 'create_staff_account',
        entityType: 'user',
        entityId: uid,
        metadata: sanitizeAuditMetadata({
          email: input.email,
          role: input.role,
          fullName: input.fullName,
          confirmElevatedAdminCreation: data.confirmElevatedAdminCreation ?? false,
        }),
        createdAt: now,
      });

      await batch.commit();
    } catch (dbErr: unknown) {
      let deleted = false;
      try {
        await auth.deleteUser(uid);
        deleted = true;
      } catch {}
      const cleanupStatus = deleted ? 'Auth cleanup completed.' : 'Auth cleanup failed (manual intervention required).';
      const msg = dbErr instanceof Error ? dbErr.message : 'Database profile creation failed.';
      throw new Error(`Staff creation failed during Firestore write: ${msg}. ${cleanupStatus}`);
    }

    return {
      success: true,
      temporaryPassword: tempPassword,
      user: {
        uid,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
      },
    };
  } catch (error: unknown) {
    logSafeAuthError('create_staff_account', error);
    return { success: false, error: mapLifecycleError(error, 'Failed to create staff account.') };
  }
}

// 3. Deactivate User Account
export async function deactivateUserAccountAction(data: { userId: string }) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    checkSelfOperation(adminUid, data.userId, 'deactivation');

    const firestore = getAdminFirestore();
    const auth = getAdminAuth();

    const userRef = firestore.collection('users').doc(data.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new Error('Target user profile not found.');
    }

    const targetUser = userSnap.data()!;
    if (targetUser.role === 'admin') {
      const activeAdminsSnap = await firestore
        .collection('users')
        .where('role', '==', 'admin')
        .where('accountStatus', '==', 'active')
        .get();

      // Count only users with active accountStatus and isActive !== false
      const activeCount = activeAdminsSnap.docs.filter((doc) => doc.data().isActive !== false).length;
      checkFinalActiveAdmin(activeCount);
    }

    // Step A: Disable Auth user & revoke refresh tokens with explicit compensation
    try {
      await auth.updateUser(data.userId, { disabled: true });
    } catch (authErr: unknown) {
      const msg = authErr instanceof Error ? authErr.message : 'Failed to disable authentication user.';
      throw new Error(`Deactivation failed on authentication service: ${msg}`);
    }

    try {
      await auth.revokeRefreshTokens(data.userId);
    } catch (tokenErr: unknown) {
      // Re-enable Auth user since token revocation failed
      let restored = false;
      try {
        await auth.updateUser(data.userId, { disabled: false });
        restored = true;
      } catch {}
      const restorationMsg = restored
        ? 'Auth user status has been restored.'
        : 'Auth status restoration failed (manual intervention required).';
      const msg = tokenErr instanceof Error ? tokenErr.message : 'Token revocation failed.';
      throw new Error(`Deactivation failed during token revocation: ${msg}. ${restorationMsg}`);
    }

    // Step B: Update Firestore profiles & Activity Log in ONE atomic batch
    const now = new Date().toISOString();
    try {
      const batch = firestore.batch();
      batch.update(userRef, {
        accountStatus: 'inactive',
        isActive: false,
        deactivatedAt: now,
        deactivatedBy: adminUid,
        updatedAt: now,
      });

      const publicRef = firestore.collection('publicUsers').doc(data.userId);
      batch.set(publicRef, { accountStatus: 'inactive', isActive: false }, { merge: true });

      const logRef = firestore.collection('activityLogs').doc();
      batch.set(logRef, {
        actorId: adminUid,
        actorName: adminUser.fullName || 'Administrator',
        actorRole: 'admin',
        action: 'deactivate_user_account',
        entityType: 'user',
        entityId: data.userId,
        metadata: sanitizeAuditMetadata({
          targetEmail: targetUser.email,
          targetRole: targetUser.role,
        }),
        createdAt: now,
      });

      await batch.commit();
    } catch (dbErr: unknown) {
      let restored = false;
      try {
        await auth.updateUser(data.userId, { disabled: false });
        restored = true;
      } catch {}
      const restorationMsg = restored
        ? 'Auth account disabled status was restored to active, but revoked refresh tokens cannot be restored. The user must sign in again.'
        : 'Auth account restoration failed (manual intervention required).';
      const msg = dbErr instanceof Error ? dbErr.message : 'Firestore update failed.';
      throw new Error(`Deactivation failed during database update: ${msg}. ${restorationMsg}`);
    }

    return { success: true };
  } catch (error: unknown) {
    logSafeAuthError('deactivate_user_account', error, data.userId);
    return { success: false, error: mapLifecycleError(error, 'Failed to deactivate user account.') };
  }
}

// 4. Reactivate User Account
export async function reactivateUserAccountAction(data: { userId: string }) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    const firestore = getAdminFirestore();
    const auth = getAdminAuth();

    const userRef = firestore.collection('users').doc(data.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new Error('Target user profile not found.');
    }

    const targetUser = userSnap.data()!;

    // Step A: Re-enable Auth user
    try {
      await auth.updateUser(data.userId, { disabled: false });
    } catch (authErr: unknown) {
      const msg = authErr instanceof Error ? authErr.message : 'Failed to enable authentication user.';
      throw new Error(`Reactivation failed on authentication service: ${msg}`);
    }

    // Step B: Update Firestore profiles & Activity Log in ONE atomic batch
    const now = new Date().toISOString();
    try {
      const batch = firestore.batch();
      batch.update(userRef, {
        accountStatus: 'active',
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
        updatedAt: now,
      });

      const publicRef = firestore.collection('publicUsers').doc(data.userId);
      batch.set(publicRef, { accountStatus: 'active', isActive: true }, { merge: true });

      const logRef = firestore.collection('activityLogs').doc();
      batch.set(logRef, {
        actorId: adminUid,
        actorName: adminUser.fullName || 'Administrator',
        actorRole: 'admin',
        action: 'reactivate_user_account',
        entityType: 'user',
        entityId: data.userId,
        metadata: sanitizeAuditMetadata({
          targetEmail: targetUser.email,
          targetRole: targetUser.role,
        }),
        createdAt: now,
      });

      await batch.commit();
    } catch (dbErr: unknown) {
      let reDisabled = false;
      try {
        await auth.updateUser(data.userId, { disabled: true });
        reDisabled = true;
      } catch {}
      const restorationMsg = reDisabled
        ? 'Auth account status restored to disabled.'
        : 'Auth account re-disabling failed (manual intervention required).';
      const msg = dbErr instanceof Error ? dbErr.message : 'Firestore update failed.';
      throw new Error(`Reactivation failed during database update: ${msg}. ${restorationMsg}`);
    }

    return { success: true };
  } catch (error: unknown) {
    logSafeAuthError('reactivate_user_account', error, data.userId);
    return { success: false, error: mapLifecycleError(error, 'Failed to reactivate user account.') };
  }
}

export type ResetPasswordResult =
  | { success: true; temporaryPassword: string; warning?: string }
  | { success: false; error: string };

// 5. Reset User Temporary Password
export async function resetUserTemporaryPasswordAction(data: {
  userId: string;
  temporaryPassword?: string;
}): Promise<ResetPasswordResult> {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();

    if (!data.userId || typeof data.userId !== 'string') {
      throw new Error('Target User ID is required.');
    }

    checkSelfOperation(adminUid, data.userId, 'temporary password reset');

    const firestore = getAdminFirestore();
    const auth = getAdminAuth();

    // Confirm Firestore user profile exists
    const userRef = firestore.collection('users').doc(data.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new Error('Target user profile not found in Firestore.');
    }

    // Confirm Firebase Auth record exists & read previous claims
    let userAuthRecord;
    try {
      userAuthRecord = await auth.getUser(data.userId);
    } catch {
      throw new Error('Target authentication record not found in Firebase Auth.');
    }

    const targetUser = userSnap.data()!;
    const previousClaims = userAuthRecord.customClaims || {};

    let tempPassword: string;
    if (data.temporaryPassword !== undefined && data.temporaryPassword !== '') {
      tempPassword = validateTemporaryPassword(data.temporaryPassword);
    } else {
      tempPassword = generateRandomTemporaryPassword();
    }

    // Step 1: Set custom claim mustChangePassword: true preserving existing claims
    try {
      await auth.setCustomUserClaims(data.userId, {
        ...previousClaims,
        role: targetUser.role || 'student',
        mustChangePassword: true,
      });
    } catch (claimErr: unknown) {
      const msg = claimErr instanceof Error ? claimErr.message : 'Claim update failed.';
      throw new Error(`Password reset failed during custom claim update: ${msg}`);
    }

    // Step 2: Update Auth password with claim rollback protection
    try {
      await auth.updateUser(data.userId, { password: tempPassword });
    } catch (passErr: unknown) {
      let rollbackSuccess = false;
      try {
        await auth.setCustomUserClaims(data.userId, previousClaims);
        rollbackSuccess = true;
      } catch {}
      const statusMsg = rollbackSuccess
        ? 'Previous custom claims restored.'
        : 'Custom claim rollback failed (manual intervention required).';
      const msg = passErr instanceof Error ? passErr.message : 'Password update failed.';
      throw new Error(`Password reset failed during Auth password update: ${msg}. ${statusMsg}`);
    }

    // Step 3: Write Firestore profile flag & Activity Log in ONE atomic batch
    const now = new Date().toISOString();
    let firestoreBatchFailed = false;
    try {
      const batch = firestore.batch();
      batch.update(userRef, {
        mustChangePassword: true,
        updatedAt: now,
      });

      const logRef = firestore.collection('activityLogs').doc();
      batch.set(logRef, {
        actorId: adminUid,
        actorName: adminUser.fullName || 'Administrator',
        actorRole: 'admin',
        action: 'reset_temporary_password',
        entityType: 'user',
        entityId: data.userId,
        metadata: sanitizeAuditMetadata({
          targetEmail: targetUser.email,
          targetRole: targetUser.role,
          mustChangePassword: true,
        }),
        createdAt: now,
      });

      await batch.commit();
    } catch (dbErr: unknown) {
      firestoreBatchFailed = true;
      logSafeAuthError('reset_password_batch_write', dbErr, data.userId);
    }

    let fallbackAuditLogged = false;
    if (firestoreBatchFailed) {
      // Attempt fallback direct profile synchronization of mustChangePassword: true
      let fallbackSynced = false;
      try {
        await userRef.update({
          mustChangePassword: true,
          updatedAt: new Date().toISOString(),
        });
        fallbackSynced = true;
      } catch (fallbackErr: unknown) {
        logSafeAuthError('reset_password_profile_fallback', fallbackErr, data.userId);
      }

      if (!fallbackSynced) {
        // Fallback profile sync failed: track disable fallback explicitly
        let accountDisabled = false;
        try {
          await auth.updateUser(data.userId, { disabled: true });
          accountDisabled = true;
        } catch (disableErr: unknown) {
          logSafeAuthError('reset_password_disable_fallback', disableErr, data.userId);
        }

        const msg = accountDisabled
          ? 'Password reset failed during database update and fallback synchronization also failed. Auth account has been disabled for security. Contact an administrator.'
          : 'Password reset failed during database update, fallback synchronization failed, and the account could not be disabled automatically. Immediate administrator intervention is required.';

        throw new Error(msg);
      }

      // Attempt separate safe fallback activity log write
      try {
        const fallbackLogRef = firestore.collection('activityLogs').doc();
        await fallbackLogRef.set({
          actorId: adminUid,
          actorName: adminUser.fullName || 'Administrator',
          actorRole: 'admin',
          action: 'reset_temporary_password_fallback',
          entityType: 'user',
          entityId: data.userId,
          metadata: sanitizeAuditMetadata({
            targetUid: data.userId,
            targetRole: targetUser.role,
            fallbackSynchronizationUsed: true,
          }),
          createdAt: new Date().toISOString(),
        });
        fallbackAuditLogged = true;
      } catch (logErr: unknown) {
        logSafeAuthError('reset_password_audit_fallback', logErr, data.userId);
      }
    }

    // Step 4: Revoke refresh tokens
    let tokenRevocationFailed = false;
    try {
      await auth.revokeRefreshTokens(data.userId);
    } catch (tokenErr: unknown) {
      tokenRevocationFailed = true;
      logSafeAuthError('reset_password_token_revocation', tokenErr, data.userId);
    }

    // Construct warning notice if partial state recovery occurred
    let warning: string | undefined = undefined;
    if (firestoreBatchFailed) {
      warning = fallbackAuditLogged
        ? 'Password reset completed, but activity logging required fallback synchronization. Password change remains enforced.'
        : 'Password reset completed and mandatory password change is enforced, but audit logging did not complete. Review the account manually.';
    } else if (tokenRevocationFailed) {
      warning = 'Password reset completed, but existing Firebase sessions could not be revoked. Normal ASCS actions remain blocked until password change.';
    }
    return {
      success: true,
      temporaryPassword: tempPassword,
      ...(warning ? { warning } : {}),
    };
  } catch (error: unknown) {
    logSafeAuthError('reset_temporary_password', error, data.userId);
    return { success: false, error: mapLifecycleError(error, 'Failed to reset temporary password.') };
  }
}

// 6. Complete Mandatory Password Change (Called by user after changing client Auth password)
/**
 * @deprecated Mandatory password change must be performed via /api/auth/change-password.
 * Direct flag clearing is disabled to prevent password change bypass.
 */
export async function completeMandatoryPasswordChangeAction() {
  return {
    success: false,
    error: 'Direct completion action is deprecated. Use the secure /api/auth/change-password endpoint.',
  };
}
