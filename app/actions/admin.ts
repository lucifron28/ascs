'use server';

import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { UserRole } from '@/lib/types/roles';
import {
  checkRoleConversion,
  checkFinalActiveAdmin,
  checkSelfOperation,
  sanitizeAuditMetadata,
  mapLifecycleError,
} from '@/lib/admin/lifecycle-validation';

// Helper to authenticate Admin user
async function getAuthenticatedAdmin() {
  const authenticated = await getAuthenticatedUser();
  if (authenticated.user.role !== 'admin') {
    throw new Error('Unauthorized: Only system administrators can access this action.');
  }
  return authenticated;
}

// 1. Fetch All System Users
export async function fetchAdminUsersAction() {
  try {
    await getAuthenticatedAdmin();
    const firestore = getAdminFirestore();

    const [usersSnap, studentsSnap] = await Promise.all([
      firestore.collection('users').orderBy('createdAt', 'desc').get(),
      firestore.collection('students').get().catch(() => null),
    ]);

    const studentMap = new Map<string, string>();
    if (studentsSnap) {
      studentsSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.studentNumber) {
          studentMap.set(doc.id, data.studentNumber);
        }
      });
    }

    const users = usersSnap.docs.map((doc) => {
      const data = doc.data();
      const role = (data.role || 'student') as UserRole;
      const studentNumber =
        data.studentNumber || (role === 'student' ? studentMap.get(doc.id) : undefined);
      const accountStatus = data.accountStatus || (data.isActive === false ? 'inactive' : 'active');
      const isActive = data.isActive !== undefined ? Boolean(data.isActive) : accountStatus === 'active';

      return {
        uid: doc.id,
        email: data.email || '',
        username: data.username || '',
        fullName: data.fullName || '',
        role,
        accountStatus,
        isActive,
        mustChangePassword: data.mustChangePassword ?? false,
        studentNumber: studentNumber || '',
        contactNumber: data.contactNumber || '',
        createdAt: data.createdAt
          ? typeof data.createdAt === 'string'
            ? data.createdAt
            : data.createdAt.toDate?.()?.toISOString?.() || new Date().toISOString()
          : new Date().toISOString(),
      };
    });

    return { success: true, users };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Fetch admin users error';
    console.error('Fetch admin users error:', error);
    return { success: false, error: message };
  }
}

// 2. Update User Role (Firestore + Custom Claims)
export async function updateUserRoleAction(data: { userId: string; newRole: UserRole }) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    const firestore = getAdminFirestore();
    const auth = getAdminAuth();

    const validRoles: UserRole[] = [
      'student',
      'librarian',
      'accountant',
      'osa_coordinator',
      'guidance_counselor',
      'area_chair',
      'adviser',
      'dean',
      'admin',
    ];
    if (!validRoles.includes(data.newRole)) {
      throw new Error(`Invalid role specified: ${data.newRole}`);
    }

    // Check target user existence and read previous role
    const userRef = firestore.collection('users').doc(data.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new Error('Target user profile not found.');
    }

    const previousData = userSnap.data()!;
    const previousRole: UserRole = (previousData.role as UserRole) || 'student';

    // 1. Safeguard: Block student <-> staff role conversions
    checkRoleConversion(previousRole, data.newRole);

    // 2. Safeguard: Prevent self-demotion
    checkSelfOperation(adminUid, data.userId, 'role demotion');

    // 3. Safeguard: Protect final active administrator from demotion
    if (previousRole === 'admin' && data.newRole !== 'admin') {
      const activeAdminsSnap = await firestore
        .collection('users')
        .where('role', '==', 'admin')
        .where('accountStatus', '==', 'active')
        .get();

      const activeAdminCount = activeAdminsSnap.docs.filter(
        (doc) => doc.data().isActive !== false
      ).length;
      checkFinalActiveAdmin(activeAdminCount);
    }

    // Read previous custom claims where possible to preserve unrelated claims
    let previousClaims: Record<string, unknown> = {};
    try {
      const userAuthRecord = await auth.getUser(data.userId);
      previousClaims = userAuthRecord.customClaims || {};
    } catch {
      // Ignore fetch error if Auth user doc is not present in local emulator
    }
    const now = new Date().toISOString();
    const publicRef = firestore.collection('publicUsers').doc(data.userId);

    // 1. Update Firestore users and publicUsers together using a batch
    const batch = firestore.batch();
    batch.update(userRef, { role: data.newRole, updatedAt: now });
    batch.set(publicRef, { role: data.newRole }, { merge: true });
    await batch.commit();

    // 2. Update Auth custom claims with rollback protection
    try {
      await auth.setCustomUserClaims(data.userId, { ...previousClaims, role: data.newRole });
    } catch {
      // Rollback Firestore batch to previous role
      try {
        const rollbackBatch = firestore.batch();
        rollbackBatch.update(userRef, { role: previousRole, updatedAt: new Date().toISOString() });
        rollbackBatch.set(publicRef, { role: previousRole }, { merge: true });
        await rollbackBatch.commit();
      } catch {
        throw new Error(
          'Role update partially failed and automatic rollback also failed. Manual administrator intervention is required.'
        );
      }

      throw new Error(
        'Role update failed while synchronizing Firebase Auth claims. Firestore rollback completed.'
      );
    }

    // 3. Write Activity Log after role synchronization succeeds
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
      actorId: adminUid,
      actorName: adminUser.fullName || 'Administrator',
      actorRole: 'admin',
      action: 'update_user_role',
      entityType: 'user',
      entityId: data.userId,
      metadata: sanitizeAuditMetadata({ previousRole, newRole: data.newRole }),
      createdAt: now,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Update user role error';
    console.error('Update user role error:', message);
    return { success: false, error: mapLifecycleError(error, 'Failed to update user role.') };
  }
}

// 3. Fetch Clearance Requirements Configuration
export async function fetchClearanceRequirementsAction() {
  try {
    await getAuthenticatedAdmin();
    const firestore = getAdminFirestore();

    const reqSnap = await firestore.collection('clearanceRequirements').orderBy('displayOrder', 'asc').get();
    const requirements = reqSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        role: data.role,
        label: data.label,
        displayOrder: data.displayOrder,
        isActive: data.isActive ?? true,
        assignedSignatoryId: data.assignedSignatoryId || null,
        assignedSignatoryName: data.assignedSignatoryName || null,
      };
    });

    return { success: true, requirements };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Fetch clearance requirements error';
    console.error('Fetch clearance requirements error:', error);
    return { success: false, error: message };
  }
}

// 4. Update Clearance Requirement Signatory Assignment
export async function updateRequirementAssignmentAction(data: {
  requirementId: string;
  assignedSignatoryId: string | null;
  assignedSignatoryName: string | null;
}) {
  try {
    const { uid: adminUid, user: adminUser } = await getAuthenticatedAdmin();
    const firestore = getAdminFirestore();
    const reqRef = firestore.collection('clearanceRequirements').doc(data.requirementId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      throw new Error('Clearance requirement record not found.');
    }

    const reqData = reqSnap.data()!;

    let derivedSignatoryName: string | null = null;
    if (data.assignedSignatoryId) {
      const targetUserSnap = await firestore.collection('users').doc(data.assignedSignatoryId).get();
      if (!targetUserSnap.exists) {
        throw new Error('Assigned signatory user profile not found.');
      }

      const targetUser = targetUserSnap.data()!;
      if (targetUser.accountStatus === 'inactive' || targetUser.isActive === false) {
        throw new Error('Assigned signatory account is inactive or deactivated.');
      }
      if (targetUser.role !== reqData.role) {
        throw new Error(
          `Role mismatch: User ${targetUser.fullName || data.assignedSignatoryId} has role '${targetUser.role}', which does not match required requirement role '${reqData.role}'.`
        );
      }
      derivedSignatoryName = targetUser.fullName || targetUser.displayName || targetUser.email || 'Assigned Signatory';
    }

    const now = new Date().toISOString();
    await reqRef.update({
      assignedSignatoryId: data.assignedSignatoryId || null,
      assignedSignatoryName: derivedSignatoryName,
      updatedAt: now,
    });

    // Activity log
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
      actorId: adminUid,
      actorName: adminUser.fullName || 'Administrator',
      actorRole: 'admin',
      action: 'update_requirement_signatory',
      entityType: 'clearanceRequirement',
      entityId: data.requirementId,
      metadata: { assignedSignatoryId: data.assignedSignatoryId, assignedSignatoryName: derivedSignatoryName },
      createdAt: now,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Update requirement assignment error';
    console.error('Update requirement assignment error:', error);
    return { success: false, error: message };
  }
}

// 5. Fetch Activity Audit Logs
export async function fetchActivityLogsAction() {
  try {
    await getAuthenticatedAdmin();
    const firestore = getAdminFirestore();

    const logsSnap = await firestore.collection('activityLogs').orderBy('createdAt', 'desc').limit(50).get();
    const logs = logsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        actorId: data.actorId,
        actorName: data.actorName || 'System',
        actorRole: data.actorRole || 'system',
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata || {},
        createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toDate?.()?.toISOString?.() || new Date().toISOString()) : new Date().toISOString(),
      };
    });

    return { success: true, logs };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Fetch activity logs error';
    console.error('Fetch activity logs error:', error);
    return { success: false, error: message };
  }
}
