'use server';

import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { UserRole } from '@/lib/types/roles';

// Helper to authenticate Admin user
async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) throw new Error('Unauthorized: No active session.');

  const claims = await getAdminAuth().verifySessionCookie(session, true);
  if (claims.role !== 'admin') {
    throw new Error('Unauthorized: Only system administrators can access this action.');
  }

  return claims;
}

// 1. Fetch All System Users
export async function fetchAdminUsersAction() {
  try {
    await getAuthenticatedAdmin();
    const firestore = getAdminFirestore();

    const usersSnap = await firestore.collection('users').orderBy('createdAt', 'desc').get();
    const users = usersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email || '',
        username: data.username || '',
        fullName: data.fullName || '',
        role: (data.role || 'student') as UserRole,
        accountStatus: data.accountStatus || 'active',
        contactNumber: data.contactNumber || '',
        createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toDate?.()?.toISOString?.() || new Date().toISOString()) : new Date().toISOString(),
      };
    });

    return { success: true, users };
  } catch (error: any) {
    console.error('Fetch admin users error:', error);
    return { success: false, error: error.message };
  }
}

// 2. Update User Role (Firestore + Custom Claims)
export async function updateUserRoleAction(data: { userId: string; newRole: UserRole }) {
  try {
    const adminClaims = await getAuthenticatedAdmin();
    const firestore = getAdminFirestore();
    const auth = getAdminAuth();

    // Prevent demoting self if admin is performing operation on own account
    if (adminClaims.uid === data.userId && data.newRole !== 'admin') {
      throw new Error('Action blocked: You cannot demote your own administrator account.');
    }

    // Update Auth custom claims
    try {
      await auth.setCustomUserClaims(data.userId, { role: data.newRole });
    } catch (authErr: any) {
      console.warn(`Auth custom claims update failed for ${data.userId}:`, authErr.message);
    }

    // Update Firestore users doc
    const userRef = firestore.collection('users').doc(data.userId);
    await userRef.update({
      role: data.newRole,
      updatedAt: new Date().toISOString(),
    });

    // Update publicUsers doc
    const publicRef = firestore.collection('publicUsers').doc(data.userId);
    await publicRef.set({ role: data.newRole }, { merge: true });

    // Write Activity Log
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
      actorId: adminClaims.uid,
      actorName: 'Administrator',
      actorRole: 'admin',
      action: 'update_user_role',
      entityType: 'user',
      entityId: data.userId,
      metadata: { newRole: data.newRole },
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Update user role error:', error);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error('Fetch clearance requirements error:', error);
    return { success: false, error: error.message };
  }
}

// 4. Update Clearance Requirement Signatory Assignment
export async function updateRequirementAssignmentAction(data: {
  requirementId: string;
  assignedSignatoryId: string | null;
  assignedSignatoryName: string | null;
}) {
  try {
    const adminClaims = await getAuthenticatedAdmin();
    const firestore = getAdminFirestore();

    const reqRef = firestore.collection('clearanceRequirements').doc(data.requirementId);
    await reqRef.update({
      assignedSignatoryId: data.assignedSignatoryId,
      assignedSignatoryName: data.assignedSignatoryName,
      updatedAt: new Date().toISOString(),
    });

    // Activity log
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
      actorId: adminClaims.uid,
      actorName: 'Administrator',
      actorRole: 'admin',
      action: 'update_requirement_signatory',
      entityType: 'clearanceRequirement',
      entityId: data.requirementId,
      metadata: { assignedSignatoryId: data.assignedSignatoryId, assignedSignatoryName: data.assignedSignatoryName },
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Update requirement assignment error:', error);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error('Fetch activity logs error:', error);
    return { success: false, error: error.message };
  }
}
