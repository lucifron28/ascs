'use server';

import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { UserRole } from '@/lib/types/roles';
import {
  StudentAccountInput,
  StaffAccountInput,
  validateStudentInput,
  validateStaffInput,
  checkSelfOperation,
  checkFinalActiveAdmin,
  generateRandomTemporaryPassword,
  sanitizeAuditMetadata,
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

    // Step A: Create Auth user & set custom claims
    let uid: string;
    try {
      const userRecord = await auth.createUser({
        email: input.email,
        password: tempPassword,
        displayName: input.fullName,
        emailVerified: true,
      });
      uid = userRecord.uid;
      await auth.setCustomUserClaims(uid, { role: 'student', mustChangePassword: true });
    } catch (authErr: unknown) {
      const msg = authErr instanceof Error ? authErr.message : 'Auth user creation failed.';
      throw new Error(`Failed to create authentication user: ${msg}`);
    }

    // Step B: Write Firestore profiles with compensation
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

      await batch.commit();
    } catch (dbErr: unknown) {
      await auth.deleteUser(uid).catch(() => {});
      const msg = dbErr instanceof Error ? dbErr.message : 'Database profile creation failed.';
      throw new Error(`Account creation failed during Firestore profile creation: ${msg}. Compensation deleted the un-configured Auth account.`);
    }

    // Step C: Write Activity Log
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
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
    const message = error instanceof Error ? error.message : 'Create student account error';
    console.error('Create student account error:', error);
    return { success: false, error: message };
  }
}

// 2. Create Staff Account
export async function createStaffAccountAction(data: StaffAccountInput) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    const input = validateStaffInput(data);

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

    // Step A: Create Auth user & set custom claims
    let uid: string;
    try {
      const userRecord = await auth.createUser({
        email: input.email,
        password: tempPassword,
        displayName: input.fullName,
        emailVerified: true,
      });
      uid = userRecord.uid;
      await auth.setCustomUserClaims(uid, { role: input.role, mustChangePassword: true });
    } catch (authErr: unknown) {
      const msg = authErr instanceof Error ? authErr.message : 'Auth staff creation failed.';
      throw new Error(`Failed to create staff authentication user: ${msg}`);
    }

    // Step B: Write Firestore profiles with compensation
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

      await batch.commit();
    } catch (dbErr: unknown) {
      await auth.deleteUser(uid).catch(() => {});
      const msg = dbErr instanceof Error ? dbErr.message : 'Database profile creation failed.';
      throw new Error(`Staff creation failed during Firestore write: ${msg}. Compensation deleted the un-configured Auth account.`);
    }

    // Step C: Write Activity Log
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
      actorId: adminUid,
      actorName: adminUser.fullName || 'Administrator',
      actorRole: 'admin',
      action: 'create_staff_account',
      entityType: 'user',
      entityId: uid,
      metadata: sanitizeAuditMetadata({
        email: input.email,
        role: input.role,
        fullName: input.fullName,
      }),
      createdAt: now,
    });

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
    const message = error instanceof Error ? error.message : 'Create staff account error';
    console.error('Create staff account error:', error);
    return { success: false, error: message };
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

      checkFinalActiveAdmin(activeAdminsSnap.size);
    }

    // Step A: Disable Auth user and revoke tokens
    try {
      await auth.updateUser(data.userId, { disabled: true });
      await auth.revokeRefreshTokens(data.userId);
    } catch (authErr: unknown) {
      const msg = authErr instanceof Error ? authErr.message : 'Failed to disable authentication user.';
      throw new Error(`Deactivation failed on authentication service: ${msg}`);
    }

    // Step B: Update Firestore with compensation
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

      await batch.commit();
    } catch (dbErr: unknown) {
      await auth.updateUser(data.userId, { disabled: false }).catch(() => {});
      const msg = dbErr instanceof Error ? dbErr.message : 'Firestore deactivation update failed.';
      throw new Error(`Deactivation failed during database update: ${msg}. Auth account status has been restored.`);
    }

    // Step C: Write Activity Log
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
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

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Deactivate user account error';
    console.error('Deactivate user account error:', error);
    return { success: false, error: message };
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

    // Step B: Update Firestore
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

      await batch.commit();
    } catch (dbErr: unknown) {
      await auth.updateUser(data.userId, { disabled: true }).catch(() => {});
      const msg = dbErr instanceof Error ? dbErr.message : 'Firestore reactivation update failed.';
      throw new Error(`Reactivation failed during database update: ${msg}. Auth account status restored.`);
    }

    // Step C: Write Activity Log
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
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

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Reactivate user account error';
    console.error('Reactivate user account error:', error);
    return { success: false, error: message };
  }
}

// 5. Reset User Temporary Password
export async function resetUserTemporaryPasswordAction(data: { userId: string; temporaryPassword?: string }) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    checkSelfOperation(adminUid, data.userId, 'temporary password reset');

    const firestore = getAdminFirestore();
    const auth = getAdminAuth();

    const userRef = firestore.collection('users').doc(data.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new Error('Target user profile not found.');
    }

    const targetUser = userSnap.data()!;
    const tempPassword = data.temporaryPassword || generateRandomTemporaryPassword();

    // Step A: Update Auth password & revoke tokens
    try {
      await auth.updateUser(data.userId, { password: tempPassword });
      await auth.revokeRefreshTokens(data.userId);

      const targetRole = (targetUser.role as UserRole) || 'student';
      await auth.setCustomUserClaims(data.userId, { role: targetRole, mustChangePassword: true });
    } catch (authErr: unknown) {
      const msg = authErr instanceof Error ? authErr.message : 'Failed to update authentication password.';
      throw new Error(`Password reset failed on authentication service: ${msg}`);
    }

    // Step B: Set mustChangePassword: true in Firestore
    const now = new Date().toISOString();
    await userRef.update({
      mustChangePassword: true,
      updatedAt: now,
    });

    // Step C: Write Activity Log (NEVER log tempPassword)
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
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

    return {
      success: true,
      temporaryPassword: tempPassword,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Reset temporary password error';
    console.error('Reset temporary password error:', error);
    return { success: false, error: message };
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
