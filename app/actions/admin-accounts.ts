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

interface StaffCreationCompensationResult {
  authDeleted: boolean;
  authDisabled: boolean;
  profilesCleaned: boolean;
  profilesDisabled: boolean;
  compensationSucceeded: boolean;
  manualInterventionRequired: boolean;
}

/**
 * Remove or disable every identity surface after a staff creation failure.
 * The fallback disable path is intentional: an Auth deletion failure must
 * never leave an active Firestore candidate that can be assigned signatory work.
 */
async function compensateStaffCreation(input: {
  auth: ReturnType<typeof getAdminAuth>;
  firestore: ReturnType<typeof getAdminFirestore>;
  uid: string;
  email: string;
  role: UserRole;
  adminUid: string;
  reason: string;
}): Promise<StaffCreationCompensationResult> {
  let authDeleted = false;
  let authDisabled = false;
  try {
    await input.auth.deleteUser(input.uid);
    authDeleted = true;
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'auth/user-not-found') {
      authDeleted = true;
    } else {
      try {
        await input.auth.updateUser(input.uid, { disabled: true });
        authDisabled = true;
      } catch {
        // Keep the profile-disable fallback, but report manual intervention
        // when Auth could not be deleted or disabled.
      }
    }
  }

  const userRef = input.firestore.collection('users').doc(input.uid);
  const publicRef = input.firestore.collection('publicUsers').doc(input.uid);
  const now = new Date().toISOString();
  const writeCompensation = async (disableProfiles: boolean) => {
    const batch = input.firestore.batch();
    if (disableProfiles) {
      batch.set(userRef, {
        accountStatus: 'inactive',
        isActive: false,
        deactivatedAt: now,
        updatedAt: now,
      }, { merge: true });
      batch.set(publicRef, {
        accountStatus: 'inactive',
        isActive: false,
        updatedAt: now,
      }, { merge: true });
    } else {
      batch.delete(userRef);
      batch.delete(publicRef);
    }
    batch.set(input.firestore.collection('activityLogs').doc(), {
      actorId: input.adminUid,
      actorName: 'System Administrator',
      actorRole: 'admin',
      action: 'create_staff_account_compensation',
      entityType: 'user',
      entityId: input.uid,
      metadata: sanitizeAuditMetadata({
        email: input.email,
        role: input.role,
        reason: input.reason,
        authDeleted,
        authDisabled,
        profilesDisabled: disableProfiles,
      }),
      createdAt: now,
    });
    await batch.commit();
  };

  let profilesCleaned = false;
  let profilesDisabled = false;
  try {
    await writeCompensation(!authDeleted);
    profilesCleaned = authDeleted;
    profilesDisabled = !authDeleted;
  } catch {
    // If a delete batch cannot be committed, retry with a safe inactive state.
    // This keeps candidate queries from exposing a partially-created account.
    try {
      await writeCompensation(true);
      profilesDisabled = true;
    } catch {
      // The caller records this as a manual-intervention condition.
    }
  }

  return {
    authDeleted,
    authDisabled,
    profilesCleaned,
    profilesDisabled,
    compensationSucceeded:
      (authDeleted && (profilesCleaned || profilesDisabled)) || (authDisabled && profilesDisabled),
    manualInterventionRequired:
      !((authDeleted && (profilesCleaned || profilesDisabled)) || (authDisabled && profilesDisabled)),
  };
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
        program: input.program,
        yearLevel: input.yearLevel,
        semester: input.semester,
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
        studentNumber: input.studentNumber,
        program: input.program,
        yearLevel: input.yearLevel,
        semester: input.semester,
      });

      const studentRef = firestore.collection('students').doc(uid);
      batch.set(studentRef, {
        uid,
        studentNumber: input.studentNumber,
        fullName: input.fullName,
        email: input.email,
        program: input.program,
        yearLevel: input.yearLevel,
        semester: input.semester,
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

      const [authRecord, userProfileSnap, publicProfileSnap, studentProfileSnap] = await Promise.all([
        auth.getUser(uid),
        firestore.collection('users').doc(uid).get(),
        firestore.collection('publicUsers').doc(uid).get(),
        firestore.collection('students').doc(uid).get(),
      ]);
      const userProfile = userProfileSnap.data();
      const publicProfile = publicProfileSnap.data();
      const studentProfile = studentProfileSnap.data();
      if (
        authRecord.customClaims?.role !== 'student' ||
        authRecord.disabled === true ||
        userProfile?.role !== 'student' ||
        userProfile?.accountStatus !== 'active' ||
        userProfile?.isActive === false ||
        publicProfile?.role !== 'student' ||
        publicProfile?.accountStatus !== 'active' ||
        publicProfile?.isActive === false ||
        studentProfile?.program !== input.program ||
        studentProfile?.yearLevel !== input.yearLevel ||
        studentProfile?.semester !== input.semester
      ) {
        throw new Error('Student account synchronization verification failed across Auth, users, publicUsers, and students.');
      }
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

      // Verify the three identity surfaces before reporting success. A staff
      // account is only usable as a signatory when Auth, users, and publicUsers
      // all carry the same role and active state.
      const [authRecord, userProfileSnap, publicProfileSnap] = await Promise.all([
        auth.getUser(uid),
        firestore.collection('users').doc(uid).get(),
        firestore.collection('publicUsers').doc(uid).get(),
      ]);
      const expectedRole = input.role;
      if (
        authRecord.customClaims?.role !== expectedRole ||
        authRecord.disabled === true ||
        userProfileSnap.data()?.role !== expectedRole ||
        publicProfileSnap.data()?.role !== expectedRole ||
        userProfileSnap.data()?.accountStatus !== 'active' ||
        userProfileSnap.data()?.isActive === false ||
        publicProfileSnap.data()?.accountStatus !== 'active' ||
        publicProfileSnap.data()?.isActive === false
      ) {
        throw new Error('Staff account synchronization verification failed across Auth, users, and publicUsers.');
      }
      if (process.env.NODE_ENV !== 'production' && process.env.ASCS_TEST_FORCE_STAFF_SYNC_FAILURE === 'true') {
        throw new Error('Forced staff synchronization failure for compensation testing.');
      }
    } catch (dbErr: unknown) {
      const compensation = await compensateStaffCreation({
        auth,
        firestore,
        uid,
        email: input.email,
        role: input.role,
        adminUid,
        reason: dbErr instanceof Error ? dbErr.message : 'Database profile creation failed.',
      });
      const cleanupStatus = compensation.manualInterventionRequired
        ? 'Compensation failed (manual intervention required).'
        : compensation.profilesDisabled
          ? 'Auth/profile compensation disabled the account safely.'
          : 'Auth/profile cleanup completed.';
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

// 7. Permanent User Deletion (Admin only)
export async function deleteUserAccountAction(data: {
  userId: string;
  isRejection?: boolean;
  rejectionReason?: string;
}) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    if (!data.userId) {
      throw new Error('User ID is required.');
    }

    checkSelfOperation(adminUid, data.userId, 'deletion');

    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    const userRef = firestore.collection('users').doc(data.userId);
    const userSnap = await userRef.get();

    let targetEmail = '';
    let targetRole: UserRole | 'unknown' = 'unknown';
    let targetFullName = '';

    if (userSnap.exists) {
      const u = userSnap.data()!;
      targetEmail = u.email || '';
      targetRole = u.role || 'unknown';
      targetFullName = u.fullName || '';

      if (targetRole === 'admin') {
        const activeAdminsSnap = await firestore
          .collection('users')
          .where('role', '==', 'admin')
          .where('accountStatus', '==', 'active')
          .get();
        checkFinalActiveAdmin(activeAdminsSnap.size);
      }
    } else {
      try {
        const authUser = await auth.getUser(data.userId);
        targetEmail = authUser.email || '';
        const claimsRole = (authUser.customClaims?.role as UserRole) || 'unknown';
        targetRole = claimsRole;
        if (targetRole === 'admin') {
          const activeAdminsSnap = await firestore
            .collection('users')
            .where('role', '==', 'admin')
            .where('accountStatus', '==', 'active')
            .get();
          checkFinalActiveAdmin(activeAdminsSnap.size);
        }
      } catch (authErr: unknown) {
        if ((authErr as { code?: string }).code === 'auth/user-not-found') {
          throw new Error('User account not found.');
        }
        throw authErr;
      }
    }

    const failedSteps: Array<{ step: string; error: string }> = [];

    async function executeStep(stepName: string, operation: () => Promise<unknown>) {
      try {
        await operation();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        failedSteps.push({ step: stepName, error: errorMsg });
        logSafeAuthError(`delete_user_step_${stepName}`, err, data.userId);
      }
    }

    // 1. Delete associated student records (applications, approvals, remarks)
    if (targetRole === 'student' || targetRole === 'unknown') {
      await executeStep('applications_and_approvals', async () => {
        const appsSnap = await firestore
          .collection('clearanceApplications')
          .where('studentUid', '==', data.userId)
          .get();

        for (const appDoc of appsSnap.docs) {
          const approvalsSnap = await appDoc.ref.collection('approvals').get();
          for (const appr of approvalsSnap.docs) {
            await appr.ref.delete();
          }
          const remarksSnap = await appDoc.ref.collection('remarks').get();
          for (const rem of remarksSnap.docs) {
            await rem.ref.delete();
          }
          await appDoc.ref.delete();
        }
      });

      await executeStep('student_notifications', async () => {
        const notifsSnap = await firestore
          .collection('notifications')
          .where('recipientId', '==', data.userId)
          .get();
        for (const notif of notifsSnap.docs) {
          await notif.ref.delete();
        }
      });

      await executeStep('students_profile', async () => {
        const studentRef = firestore.collection('students').doc(data.userId);
        const studentDoc = await studentRef.get();
        if (studentDoc.exists) {
          await studentRef.delete();
        }
      });
    }

    // 2. Unassign from requirements if staff
    if (targetRole !== 'student') {
      await executeStep('requirement_unassignment', async () => {
        const reqsSnap = await firestore
          .collection('clearanceRequirements')
          .where('assignedSignatoryId', '==', data.userId)
          .get();
        for (const reqDoc of reqsSnap.docs) {
          await reqDoc.ref.update({
            assignedSignatoryId: null,
            assignedSignatoryName: null,
            updatedAt: new Date().toISOString(),
          });
        }
      });
    }

    // 3. Delete Firestore identity profiles
    await executeStep('public_users_profile', async () => {
      const publicRef = firestore.collection('publicUsers').doc(data.userId);
      const publicDoc = await publicRef.get();
      if (publicDoc.exists) {
        await publicRef.delete();
      }
    });

    await executeStep('users_profile', async () => {
      const targetUserDoc = await userRef.get();
      if (targetUserDoc.exists) {
        await userRef.delete();
      }
    });

    // 4. Delete Auth user
    await executeStep('auth_user', async () => {
      try {
        await auth.deleteUser(data.userId);
      } catch (authDeleteErr: unknown) {
        if ((authDeleteErr as { code?: string }).code !== 'auth/user-not-found') {
          throw authDeleteErr;
        }
      }
    });

    const now = new Date().toISOString();

    // 5. If any cleanup step failed, report safe failure and record audit log
    if (failedSteps.length > 0) {
      const failureLogRef = firestore.collection('activityLogs').doc();
      await failureLogRef.set({
        actorId: adminUid,
        actorName: adminUser.fullName || 'Administrator',
        actorRole: 'admin',
        action: 'delete_user_account_failed',
        entityType: 'user',
        entityId: data.userId,
        metadata: sanitizeAuditMetadata({
          deletedEmail: targetEmail,
          deletedRole: targetRole,
          failedSteps: failedSteps.map((s) => s.step),
          partialCleanup: true,
        }),
        createdAt: now,
      }).catch(() => {});

      logSafeAuthError('delete_user_account_partial_failure', { failedSteps }, data.userId);
      return {
        success: false,
        error: `User account deletion could not be completed for all associated records (${failedSteps.map((s) => s.step).join(', ')}). Manual review required.`,
      };
    }

    // 6. All steps succeeded: record success activity log
    const actionName = data.isRejection ? 'reject_student_registration' : 'delete_user_account';
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
      actorId: adminUid,
      actorName: adminUser.fullName || 'Administrator',
      actorRole: 'admin',
      action: actionName,
      entityType: 'user',
      entityId: data.userId,
      metadata: sanitizeAuditMetadata({
        deletedEmail: targetEmail,
        deletedRole: targetRole,
        deletedFullName: targetFullName,
        reason: data.rejectionReason || null,
      }),
      createdAt: now,
    });

    return {
      success: true,
      message: data.isRejection
        ? 'Student registration rejected and account deleted.'
        : 'User account permanently deleted.',
    };
  } catch (error: unknown) {
    logSafeAuthError('delete_user_account', error, data.userId);
    return { success: false, error: mapLifecycleError(error, 'Failed to delete user account.') };
  }
}

// 8. Approve Student Self-Registration (Admin only)
export async function approveStudentRegistrationAction(data: { userId: string }) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    if (!data.userId) {
      throw new Error('User ID is required.');
    }

    const firestore = getAdminFirestore();
    const auth = getAdminAuth();
    const userRef = firestore.collection('users').doc(data.userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new Error('User profile not found.');
    }

    const userData = userSnap.data()!;
    if (userData.accountStatus !== 'pending_approval') {
      throw new Error(`Cannot approve registration: Account status is '${userData.accountStatus}'.`);
    }

    try {
      await auth.updateUser(data.userId, { disabled: false });
      await auth.setCustomUserClaims(data.userId, {
        role: 'student',
        accountStatus: 'active',
        mustChangePassword: false,
      });
    } catch (authErr: unknown) {
      logSafeAuthError('approve_student_auth_update', authErr, data.userId);
      throw new Error('Failed to update authentication claims for approved student.');
    }

    const now = new Date().toISOString();
    const batch = firestore.batch();

    batch.update(userRef, {
      accountStatus: 'active',
      isActive: true,
      updatedAt: now,
      approvedAt: now,
      approvedBy: adminUid,
    });

    const publicRef = firestore.collection('publicUsers').doc(data.userId);
    batch.update(publicRef, {
      accountStatus: 'active',
      isActive: true,
      updatedAt: now,
    });

    const studentRef = firestore.collection('students').doc(data.userId);
    const studentSnap = await studentRef.get();
    if (studentSnap.exists) {
      batch.update(studentRef, {
        accountStatus: 'active',
        updatedAt: now,
      });
    }

    const logRef = firestore.collection('activityLogs').doc();
    batch.set(logRef, {
      actorId: adminUid,
      actorName: adminUser.fullName || 'Administrator',
      actorRole: 'admin',
      action: 'approve_student_registration',
      entityType: 'user',
      entityId: data.userId,
      metadata: sanitizeAuditMetadata({
        email: userData.email,
        fullName: userData.fullName,
        studentNumber: userData.studentNumber,
      }),
      createdAt: now,
    });

    const notifRef = firestore.collection('notifications').doc();
    batch.set(notifRef, {
      recipientId: data.userId,
      type: 'registration_approved',
      message: 'Your student registration has been approved. You can now log in and submit your clearance application.',
      isRead: false,
      createdAt: now,
    });

    await batch.commit();
    return { success: true, message: 'Student registration approved successfully.' };
  } catch (error: unknown) {
    logSafeAuthError('approve_student_registration', error, data.userId);
    return { success: false, error: mapLifecycleError(error, 'Failed to approve student registration.') };
  }
}

// 9. Reject Student Self-Registration (Admin only)
export async function rejectStudentRegistrationAction(data: { userId: string; reason?: string }) {
  try {
    await getAuthenticatedAdmin();
    if (!data?.userId) {
      throw new Error('User ID is required.');
    }

    const firestore = getAdminFirestore();
    const userRef = firestore.collection('users').doc(data.userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new Error('User profile not found.');
    }

    const userData = userSnap.data()!;
    if (userData.accountStatus !== 'pending_approval') {
      throw new Error(`Cannot reject registration: Account status is '${userData.accountStatus}'.`);
    }

    return await deleteUserAccountAction({
      userId: data.userId,
      isRejection: true,
      rejectionReason: data.reason,
    });
  } catch (error: unknown) {
    logSafeAuthError('reject_student_registration', error, data.userId);
    return { success: false, error: mapLifecycleError(error, 'Failed to reject student registration.') };
  }
}
