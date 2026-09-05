'use server';

import { getAdminFirestore } from '@/lib/firebase/admin';
import { normalizeSemester, getApplicationTermDocumentIds } from '@/lib/academic-term';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getClearanceStatusSummary, REQUIRED_SIGNATORY_ROLES } from '@/lib/clearance/status';
import {
  CLEARANCE_WORKFLOW_STAGES,
  canRoleActOnApplication,
  getCurrentWorkflowStage,
  getWorkflowProgress,
  getWorkflowStageByKey,
  getWorkflowStageForRole,
  getWorkflowStageStatus,
  isFinancialStageActionable,
  isWorkflowStagePassed,
  type ClearanceWorkflowStage,
  type WorkflowApproval,
  type WorkflowState,
} from '@/lib/clearance/workflow';
import { logClearanceActionError, mapClearanceActionError } from '@/lib/clearance/action-errors';
import type {
  QueryDocumentSnapshot,
  DocumentSnapshot,
  Transaction,
  DocumentData,
  DocumentReference,
} from 'firebase-admin/firestore';

type AdminFirestore = ReturnType<typeof getAdminFirestore>;

function toWorkflowApproval(doc: { data: () => DocumentData }): WorkflowApproval {
  const data = doc.data();
  return {
    signatoryRole: typeof data.signatoryRole === 'string' ? data.signatoryRole : null,
    status: typeof data.status === 'string' ? data.status : null,
  };
}

function toWorkflowState(approvalDocs: readonly { data: () => DocumentData }[], financialStatus: unknown): WorkflowState {
  return {
    approvals: approvalDocs.map(toWorkflowApproval),
    financialStatus: typeof financialStatus === 'string' ? financialStatus : null,
  };
}

function isActiveUser(data: DocumentData | undefined): boolean {
  return Boolean(data && data.accountStatus !== 'inactive' && data.isActive !== false);
}

async function getApplicationStageRecipientIds(
  transaction: Transaction,
  firestore: AdminFirestore,
  stage: ClearanceWorkflowStage,
  approvals: readonly QueryDocumentSnapshot[] | readonly DocumentSnapshot[],
): Promise<string[]> {
  if (stage.kind === 'financial') {
    const usersQuery = firestore.collection('users').where('role', '==', stage.role);
    const usersSnap = await transaction.get(usersQuery);
    return usersSnap.docs
      .filter((doc) => isActiveUser(doc.data()))
      .map((doc) => doc.id);
  }

  if (stage.kind === 'approval') {
    const approvalDoc = approvals.find((doc) => doc.data()?.signatoryRole === stage.role);
    const approvalData = approvalDoc?.data();
    const assignedSignatoryId = typeof approvalData?.assignedSignatoryId === 'string' && approvalData.assignedSignatoryId.trim() !== ''
      ? approvalData.assignedSignatoryId
      : null;

    if (assignedSignatoryId) {
      const assignedSnap = await transaction.get(firestore.collection('users').doc(assignedSignatoryId));
      if (assignedSnap.exists && isActiveUser(assignedSnap.data()) && assignedSnap.data()?.role === stage.role) {
        return [assignedSignatoryId];
      }
      return [];
    }

    const usersQuery = firestore.collection('users').where('role', '==', stage.role);
    const usersSnap = await transaction.get(usersQuery);
    return usersSnap.docs
      .filter((doc) => isActiveUser(doc.data()))
      .map((doc) => doc.id);
  }

  return [];
}

function formatRoleName(role: string): string {
  return role.replace(/_/g, ' ').toUpperCase();
}

// 1. Submit Clearance Application (Student)
export async function submitApplicationAction(data: {
  academicYear: string;
  semester: string;
  purpose: string;
}) {
  try {
    const { uid: studentUid, user } = await getAuthenticatedUser();

    if (!data.academicYear?.trim() || !data.semester?.trim() || !data.purpose?.trim()) {
      throw new Error('Academic year, semester, and purpose are required fields.');
    }

    if (user.role !== 'student') {
      throw new Error('Unauthorized: Only students can submit clearance applications.');
    }

    const firestore = getAdminFirestore();

    const semester = normalizeSemester(data.semester);
    const termDocIds = getApplicationTermDocumentIds(studentUid, data.academicYear, semester);
    const appId = termDocIds[0];

    // Execute submission in a Firestore Transaction
    await firestore.runTransaction(async (transaction: Transaction) => {
      for (const checkAppId of termDocIds) {
        const checkAppRef = firestore.collection('clearanceApplications').doc(checkAppId);
        const checkAppSnap = await transaction.get(checkAppRef);

        if (checkAppSnap.exists) {
          throw new Error(`Already submitted a clearance application for ${data.academicYear} ${semester}.`);
        }
      }
      const appRef = firestore.collection('clearanceApplications').doc(appId);

      // Fetch student record for denormalization
      const studentRef = firestore.collection('students').doc(studentUid);
      const studentSnap = await transaction.get(studentRef);

      if (!studentSnap.exists) {
        throw new Error('Student profile record not found. Please contact administration.');
      }

      const student = studentSnap.data()!;

      // Fetch active signatory requirements. Accountant is Stage 2 of the
      // workflow but remains represented by financialStatus, not an approval row.
      const reqColRef = firestore.collection('clearanceRequirements');
      const requirementsQuery = await transaction.get(reqColRef.where('isActive', '==', true));

      const activeReqs = requirementsQuery.docs
        .map((doc: QueryDocumentSnapshot<DocumentData>) => {
          const reqData = doc.data();
          return {
            id: doc.id,
            role: reqData.role as string,
            label: (reqData.label as string) || (reqData.role as string),
            assignedSignatoryId: (reqData.assignedSignatoryId as string | null) || null,
            assignedSignatoryName: (reqData.assignedSignatoryName as string | null) || null,
          };
        })
        .filter((req) => (REQUIRED_SIGNATORY_ROLES as readonly string[]).includes(req.role))
        .sort((a, b) => {
          const aStage = CLEARANCE_WORKFLOW_STAGES.find((stage) => stage.role === a.role)?.stage || 999;
          const bStage = CLEARANCE_WORKFLOW_STAGES.find((stage) => stage.role === b.role)?.stage || 999;
          return aStage - bStage;
        });

      if (activeReqs.length === 0) {
        throw new Error('No active clearance signatory requirements are configured.');
      }

      const configuredRoles = new Set(activeReqs.map((requirement) => requirement.role));
      const hasEveryRequiredRole = REQUIRED_SIGNATORY_ROLES.every((role) => configuredRoles.has(role));
      if (activeReqs.length !== REQUIRED_SIGNATORY_ROLES.length || configuredRoles.size !== REQUIRED_SIGNATORY_ROLES.length || !hasEveryRequiredRole) {
        throw new Error('All five active signatory clearance requirements must be configured before submitting.');
      }

      // Only Stage 1 is eligible on submission. Later offices are notified as
      // their preceding stage is completed.
      let librarianRecipients: string[] = [];
      const librarianReq = activeReqs.find((req) => req.role === 'librarian');
      if (librarianReq?.assignedSignatoryId) {
        const assignedSnap = await transaction.get(firestore.collection('users').doc(librarianReq.assignedSignatoryId));
        if (assignedSnap.exists && isActiveUser(assignedSnap.data()) && assignedSnap.data()?.role === 'librarian') {
          librarianRecipients = [librarianReq.assignedSignatoryId];
        }
      } else {
        const usersSnap = await transaction.get(firestore.collection('users').where('role', '==', 'librarian'));
        librarianRecipients = usersSnap.docs
          .filter((doc) => isActiveUser(doc.data()))
          .map((doc) => doc.id);
      }

      const appNumber = `CLR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      // Create Parent Application
      const applicationData = {
        applicationNumber: appNumber,
        studentId: studentUid,
        studentUid: studentUid,
        studentNumber: student.studentNumber,
        studentName: student.fullName,
        program: student.program,
        yearLevel: student.yearLevel,
        section: student.section,
        academicYear: data.academicYear,
        semester: semester,
        purpose: data.purpose,
        overallStatus: 'pending',
        financialStatus: 'pending', // Starts as pending verified
        financialVerifiedAt: null,
        financialRemarks: null,
        financialUpdatedBy: null,
        financialUpdatedByName: null,
        deanApproved: false,
        printableAvailable: false,
        pendingCount: activeReqs.length,
        approvedCount: 0,
        notApprovedCount: 0,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      transaction.set(appRef, applicationData);

      // Create Approvals subcollection
      activeReqs.forEach((req) => {
        const approvalRef = appRef.collection('approvals').doc(req.id);
        transaction.set(approvalRef, {
          requirementId: req.id,
          signatoryRole: req.role,
          assignedSignatoryId: req.assignedSignatoryId || null,
          assignedSignatoryName: req.assignedSignatoryName || null,
          status: 'pending',
          remarksLatest: null,
          actedAt: null,
          updatedAt: new Date().toISOString()
        });
      });

      // Log Activity
      const logRef = firestore.collection('activityLogs').doc();
      transaction.set(logRef, {
        actorId: studentUid,
        actorName: student.fullName,
        actorRole: 'student',
        action: 'submitted_application',
        entityType: 'clearance_application',
        entityId: appId,
        metadata: { academicYear: data.academicYear, semester: semester, purpose: data.purpose },
        createdAt: new Date().toISOString()
      });

      // Add Student Notification
      const now = new Date().toISOString();
      const notifRef = firestore.collection('notifications').doc();
      transaction.set(notifRef, {
        recipientId: studentUid,
        type: 'application_submitted',
        message: `Your clearance application ${appNumber} has been successfully submitted.`,
        relatedApplicationId: appId,
        isRead: false,
        createdAt: now
      });

      // Notify only the first actionable office. Later stages must not receive
      // work before their prerequisites pass.
      for (const recipientId of librarianRecipients) {
        if (recipientId === studentUid) continue;
        const sigNotifRef = firestore.collection('notifications').doc();
        transaction.set(sigNotifRef, {
          recipientId,
          type: 'signatory_action_required',
          message: `A new clearance application ${appNumber} from ${student.fullName} requires Librarian Clearance review.`,
          relatedApplicationId: appId,
          isRead: false,
          createdAt: now
        });
      }
    });

    return { success: true, applicationId: appId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Submit application error';
    console.error('Submit application action error:', error);
    return { success: false, error: message };
  }
}

// 2. Fetch Student Dashboard Details
export async function fetchStudentDashboardAction() {
  try {
    const { uid: studentUid, user } = await getAuthenticatedUser();

    if (user.role !== 'student' && user.role !== 'admin') {
      throw new Error('Unauthorized: Only students can access the student dashboard.');
    }

    const firestore = getAdminFirestore();
    const appQuery = await firestore.collection('clearanceApplications')
      .where('studentUid', '==', studentUid)
      .orderBy('submittedAt', 'desc')
      .limit(1)
      .get();

    if (appQuery.empty) {
      return { success: true, application: null };
    }

    const appDoc = appQuery.docs[0];
    const rawApplication = { id: appDoc.id, ...appDoc.data() } as Record<string, unknown>;

    // Fetch approvals subcollection
    const approvalsQuery = await appDoc.ref.collection('approvals').get();
    const workflowState = toWorkflowState(approvalsQuery.docs, rawApplication.financialStatus);
    const workflowProgress = getWorkflowProgress(workflowState);
    const statusSummary = getClearanceStatusSummary(
      workflowState.approvals,
      rawApplication.financialStatus as string | null | undefined,
    );
    const application = {
      ...rawApplication,
      overallStatus: statusSummary.overallStatus,
      printableAvailable: statusSummary.printableAvailable,
      pendingCount: statusSummary.pendingCount,
      approvedCount: statusSummary.approvedCount,
      notApprovedCount: statusSummary.notApprovedCount,
    };
    
    // Fetch requirements to resolve display order
    const reqsQuery = await firestore.collection('clearanceRequirements').get();
    const reqsMap = new Map();
    reqsQuery.forEach(doc => {
      reqsMap.set(doc.id, doc.data());
    });

    const activeRoleSet = new Set<string>(REQUIRED_SIGNATORY_ROLES);
    const approvals = approvalsQuery.docs.filter((doc) => {
      const role = doc.data().signatoryRole;
      return typeof role === 'string' && activeRoleSet.has(role);
    }).map(doc => {
      const data = doc.data();
      const req = reqsMap.get(data.requirementId);
      return {
        id: doc.id,
        requirementId: data.requirementId,
        signatory_role: data.signatoryRole,
        status: data.status,
        assignee_name: data.assignedSignatoryName || null,
        acted_at: data.actedAt || null,
        remarks_latest: data.remarksLatest || null,
        label: req?.label || data.signatoryRole,
        displayOrder: req?.displayOrder || 99
      };
    }).sort((a, b) => a.displayOrder - b.displayOrder);

    const workflowStages = CLEARANCE_WORKFLOW_STAGES.map((stage) => {
      const approval = stage.kind === 'approval'
        ? approvalsQuery.docs.find((doc) => doc.data().signatoryRole === stage.role)
        : undefined;
      const approvalData = approval?.data();
      return {
        stage: stage.stage,
        key: stage.key,
        role: stage.role,
        kind: stage.kind,
        label: stage.label,
        responsibleTitle: stage.responsibleTitle,
        status: getWorkflowStageStatus(stage, workflowState),
        approvalStatus: stage.kind === 'approval' ? (approvalData?.status || 'pending') : null,
        financialStatus: stage.kind === 'financial' ? (rawApplication.financialStatus || 'pending') : null,
        assignedSignatoryName: approvalData?.assignedSignatoryName || null,
        actedAt: approvalData?.actedAt || null,
        remarksLatest: approvalData?.remarksLatest || null,
      };
    });

    // Fetch remarks subcollection
    const remarksQuery = await appDoc.ref.collection('remarks')
      .orderBy('createdAt', 'desc')
      .get();
    
    const remarks = remarksQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Format financial segment to match student dashboard props
    const financial = {
      status: (rawApplication.financialStatus as string) || 'pending',
      notes: (rawApplication.financialRemarks as string | null) || null,
      verified_at: (rawApplication.financialVerifiedAt as string | null) || null,
    };

    return {
      success: true,
      application,
      approvals,
      remarks,
      financial,
      workflow: {
        stages: workflowStages,
        completedStages: workflowProgress.completedStages,
        totalStages: workflowProgress.totalStages,
        currentStage: workflowProgress.currentStage?.key || null,
      },
    };
  } catch (error: unknown) {
    logClearanceActionError('fetchStudentDashboard', error);
    return { success: false, error: mapClearanceActionError('fetchStudentDashboard', error) };
  }
}

// 3. Fetch Pending Approvals Queue (Signatory)
export async function fetchPendingApprovalsAction() {
  try {
    const { uid: userId, user } = await getAuthenticatedUser();
    const role = user.role;

    if (!(REQUIRED_SIGNATORY_ROLES as readonly string[]).includes(role)) {
      throw new Error('Unauthorized: Only active clearance signatories can access evaluator queues.');
    }

    const firestore = getAdminFirestore();
    const approvalsQuery = await firestore.collectionGroup('approvals')
      .where('status', '==', 'pending')
      .where('signatoryRole', '==', role)
      .get();
    const pendingQueue: Array<Record<string, unknown>> = [];

    for (const approvalDoc of approvalsQuery.docs) {
      const approvalData = approvalDoc.data();
      if (approvalData.assignedSignatoryId && approvalData.assignedSignatoryId !== userId) continue;

      const appRef = approvalDoc.ref.parent.parent;
      if (!appRef) continue;
      const appSnap = await appRef.get();
      if (!appSnap.exists) continue;
      const appData = appSnap.data()!;
      const approvalsSnap = await appRef.collection('approvals').get();
      const workflowState = toWorkflowState(approvalsSnap.docs, appData.financialStatus);
      if (!canRoleActOnApplication(role, workflowState)) continue;

      pendingQueue.push({
        approval_id: approvalDoc.id,
        signatory_role: approvalData.signatoryRole,
        status: approvalData.status,
        application_id: appSnap.id,
        application_number: appData.applicationNumber,
        academic_year: appData.academicYear,
        semester: appData.semester,
        purpose: appData.purpose,
        submitted_at: appData.submittedAt,
        student_id_number: appData.studentNumber,
        student_name: appData.studentName,
        workflow_stage: getWorkflowStageForRole(role)?.stage || null,
      });
    }

    // Sort by submission date ascending (oldest first)
    pendingQueue.sort((a, b) => new Date(a.submitted_at as string).getTime() - new Date(b.submitted_at as string).getTime());

    return { success: true, role, pendingQueue };
  } catch (error: unknown) {
    logClearanceActionError('fetchPendingApprovals', error);
    return { success: false, error: mapClearanceActionError('fetchPendingApprovals', error) };
  }
}

// 4. Sign/Action Clearance Approval (Signatory)
export async function signClearanceAction(data: {
  applicationId: string;
  approvalId: string;
  status: 'approved' | 'pending' | 'not_approved';
  remarks: string;
}) {
  try {
    const { uid: signatoryId, user } = await getAuthenticatedUser();
    if (!(REQUIRED_SIGNATORY_ROLES as readonly string[]).includes(user.role)) {
      throw new Error('Unauthorized: This account is not an active clearance signatory.');
    }
    if (!data.applicationId || !data.approvalId) {
      throw new Error('Application and approval identifiers are required.');
    }

    const validApprovalStatuses = ['approved', 'pending', 'not_approved'] as const;
    if (!validApprovalStatuses.includes(data.status as unknown as (typeof validApprovalStatuses)[number])) {
      throw new Error('Invalid clearance approval status.');
    }

    const trimmedRemarks = data.remarks?.trim() || '';
    if (data.status !== 'approved' && !trimmedRemarks) {
      throw new Error('Remarks are required when marking an approval as pending or not approved.');
    }

    const firestore = getAdminFirestore();
    const appRef = firestore.collection('clearanceApplications').doc(data.applicationId);
    const approvalRef = appRef.collection('approvals').doc(data.approvalId);
    await firestore.runTransaction(async (transaction: Transaction) => {
      // Every read is completed before any write so the status decision is
      // based on one consistent application snapshot.
      const appSnap = await transaction.get(appRef);
      const approvalSnap = await transaction.get(approvalRef);
      const approvalsSnap = await transaction.get(appRef.collection('approvals'));

      if (!appSnap.exists || !approvalSnap.exists) {
        throw new Error('Clearance approval record not found.');
      }

      const appData = appSnap.data()!;
      const approvalData = approvalSnap.data()!;
      if (approvalData.signatoryRole !== user.role) {
        throw new Error('Unauthorized: Evaluator department mismatch.');
      }
      if (approvalData.assignedSignatoryId && approvalData.assignedSignatoryId !== signatoryId) {
        throw new Error('Unauthorized: This approval is assigned to another signatory.');
      }
      if (approvalData.status === 'approved' || approvalData.status === 'not_approved') {
        throw new Error('This clearance decision has already been finalized.');
      }

      const workflowState = toWorkflowState(approvalsSnap.docs, appData.financialStatus);
      if (!canRoleActOnApplication(user.role, workflowState)) {
        throw new Error('This clearance stage is locked until the previous stage is completed.');
      }

      const approvalStatuses: Array<{ status: string; signatoryRole?: string }> = approvalsSnap.docs.map((doc: QueryDocumentSnapshot) => ({
        status: doc.id === data.approvalId ? data.status : doc.data().status,
        signatoryRole: doc.id === data.approvalId ? approvalData.signatoryRole : doc.data().signatoryRole,
      }));
      const summary = getClearanceStatusSummary(approvalStatuses, appData.financialStatus);
      const deanRows = approvalStatuses.filter((approval) => approval.signatoryRole === 'dean');
      const deanApproved = deanRows.length > 0 && deanRows.every((approval) => approval.status === 'approved');
      const now = new Date().toISOString();

      const isApprovalTransition = data.status === 'approved' && approvalData.status !== 'approved';
      const unlockNotifications: Array<{ ref: DocumentReference; recipientId: string; message: string }> = [];
      if (isApprovalTransition) {
        const nextApprovals = approvalsSnap.docs.map((doc: QueryDocumentSnapshot) => ({
          signatoryRole: doc.id === data.approvalId ? approvalData.signatoryRole : doc.data().signatoryRole,
          status: doc.id === data.approvalId ? data.status : doc.data().status,
        }));
        const nextWorkflowState: WorkflowState = {
          approvals: nextApprovals,
          financialStatus: appData.financialStatus,
        };
        const nextStage = getCurrentWorkflowStage(nextWorkflowState);
        if (nextStage) {
          const nextRecipients = await getApplicationStageRecipientIds(
            transaction,
            firestore,
            nextStage,
            approvalsSnap.docs,
          );
          for (const recipientId of nextRecipients) {
            if (recipientId === appData.studentUid) continue;
            const ref = firestore.collection('notifications').doc(`unlock-${data.applicationId}-${nextStage.key}-${recipientId}`);
            const existing = await transaction.get(ref);
            if (!existing.exists) {
              unlockNotifications.push({
                ref,
                recipientId,
                message: `Clearance application ${appData.applicationNumber} is ready for ${nextStage.label} review.`,
              });
            }
          }
        }
      }

      transaction.update(approvalRef, {
        status: data.status,
        remarksLatest: data.remarks || null,
        // A real Dean action supersedes the migration marker that records
        // the row was initially created from legacy Adviser history.
        migratedFromLegacyAdviser: false,
        // Unassigned approvals remain role-wide queue items. The actor is
        // recorded separately rather than silently converting a queue item
        // into an assignment.
        actedById: signatoryId,
        actedByName: user.fullName,
        actedAt: now,
        updatedAt: now,
      });

      if (data.remarks && data.remarks.trim() !== '') {
        const remarkRef = appRef.collection('remarks').doc();
        transaction.set(remarkRef, {
          approvalId: data.approvalId,
          authorId: signatoryId,
          authorName: user.fullName,
          authorRole: user.role,
          content: data.remarks.trim(),
          createdAt: now,
        });
      }

      transaction.update(appRef, {
        overallStatus: summary.overallStatus,
        pendingCount: summary.pendingCount,
        approvedCount: summary.approvedCount,
        notApprovedCount: summary.notApprovedCount,
        deanApproved,
        printableAvailable: summary.printableAvailable,
        updatedAt: now,
      });

      const logRef = firestore.collection('activityLogs').doc();
      transaction.set(logRef, {
        actorId: signatoryId,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'approval_action',
        entityType: 'clearance_approval',
        entityId: data.approvalId,
        metadata: { applicationId: data.applicationId, status: data.status, remarks: data.remarks || null },
        createdAt: now,
      });

      const notifRef = firestore.collection('notifications').doc();
      transaction.set(notifRef, {
        recipientId: appData.studentUid,
        type: 'approval_updated',
        message: `Your ${formatRoleName(approvalData.signatoryRole)} approval is now ${data.status.replace('_', ' ')}.`,
        relatedApplicationId: data.applicationId,
        isRead: false,
        createdAt: now,
      });

      for (const unlock of unlockNotifications) {
        transaction.set(unlock.ref, {
          recipientId: unlock.recipientId,
          type: 'workflow_stage_unlocked',
          message: unlock.message,
          relatedApplicationId: data.applicationId,
          isRead: false,
          createdAt: now,
        });
      }
    });

    return { success: true };
  } catch (error: unknown) {
    logClearanceActionError('signClearance', error);
    return { success: false, error: mapClearanceActionError('signClearance', error) };
  }
}

// 5. Fetch Accountant Financial Queue
export async function fetchFinancialQueueAction() {
  try {
    const { user } = await getAuthenticatedUser();

    if (user.role !== 'accountant' && user.role !== 'admin') {
      throw new Error('Unauthorized: Only accountants can access financial accounts.');
    }

    const firestore = getAdminFirestore();
    const appsQuery = await firestore.collection('clearanceApplications')
      .orderBy('submittedAt', 'desc')
      .get();
    const librarianStage = getWorkflowStageByKey('librarian');
    const allEligibleRecords: Array<Record<string, unknown>> = [];

    for (const doc of appsQuery.docs) {
      const data = doc.data();
      const approvalsSnap = await doc.ref.collection('approvals').get();
      const workflowState = toWorkflowState(approvalsSnap.docs, data.financialStatus);
      if (!librarianStage || !isWorkflowStagePassed(librarianStage, workflowState)) continue;
      const actionable = isFinancialStageActionable(workflowState);
      allEligibleRecords.push({
        id: doc.id, // Re-use doc ID as record ID for simplicity
        application_id: doc.id,
        student_id: data.studentId,
        status: data.financialStatus,
        notes: data.financialRemarks || null,
        verified_at: data.financialVerifiedAt,
        recorded_at: data.submittedAt,
        application_number: data.applicationNumber,
        academic_year: data.academicYear,
        semester: data.semester,
        purpose: data.purpose,
        overall_status: data.overallStatus,
        student_name: data.studentName,
        student_id_number: data.studentNumber,
        is_actionable: actionable,
      });
    }

    const financialQueue = allEligibleRecords.filter((record) => record.is_actionable === true);
    const financialHistory = allEligibleRecords.filter((record) => record.is_actionable !== true);

    return { success: true, financialQueue, financialHistory };
  } catch (error: unknown) {
    logClearanceActionError('fetchFinancialQueue', error);
    return { success: false, error: mapClearanceActionError('fetchFinancialQueue', error) };
  }
}

// 6. Update Student Financial Status (Accountant)
export async function updateFinancialStatusAction(data: {
  recordId: string; // matches application ID
  status: 'paid' | 'unpaid';
  financialRemarks: string;
}) {
  try {
    const { uid: accountantId, user } = await getAuthenticatedUser();

    if (user.role !== 'accountant' && user.role !== 'admin') {
      throw new Error('Unauthorized: Only accountants can modify financial status.');
    }
    const validFinancialStatuses = ['paid', 'unpaid'] as const;
    if (!validFinancialStatuses.includes(data.status as unknown as (typeof validFinancialStatuses)[number])) {
      throw new Error('Invalid financial status.');
    }

    const trimmedRemarks = data.financialRemarks?.trim() || '';
    if (data.status === 'unpaid' && !trimmedRemarks) {
      throw new Error("Remarks are required when marking a student as 'unpaid'.");
    }
    const firestore = getAdminFirestore();
    const appRef = firestore.collection('clearanceApplications').doc(data.recordId);

    await firestore.runTransaction(async (transaction: Transaction) => {
      // Read the application and every approval before writing any status so
      // concurrent signatory actions cannot compute from a stale snapshot.
      const appSnap = await transaction.get(appRef);
      const approvalsSnap = await transaction.get(appRef.collection('approvals'));
      if (!appSnap.exists) {
        throw new Error('Clearance application not found.');
      }

      const appData = appSnap.data()!;
      if (appData.financialStatus === 'paid') {
        throw new Error('Accountant Clearance has already been completed.');
      }

      const workflowState = toWorkflowState(approvalsSnap.docs, appData.financialStatus);
      if (!isFinancialStageActionable(workflowState)) {
        throw new Error('Accountant Clearance is locked until Librarian Clearance is approved.');
      }

      const wasPaid = appData.financialStatus === 'paid';
      const paidTransition = data.status === 'paid' && !wasPaid;
      const unlockNotifications: Array<{ ref: DocumentReference; recipientId: string; message: string }> = [];
      if (paidTransition) {
        const nextWorkflowState: WorkflowState = {
          approvals: approvalsSnap.docs.map((doc: QueryDocumentSnapshot) => ({
            signatoryRole: doc.data().signatoryRole,
            status: doc.data().status,
          })),
          financialStatus: data.status,
        };
        const nextStage = getCurrentWorkflowStage(nextWorkflowState);
        if (nextStage) {
          const nextRecipients = await getApplicationStageRecipientIds(
            transaction,
            firestore,
            nextStage,
            approvalsSnap.docs,
          );
          for (const recipientId of nextRecipients) {
            if (recipientId === appData.studentUid) continue;
            const ref = firestore.collection('notifications').doc(
              `unlock-${data.recordId}-${nextStage.key}-${recipientId}`,
            );
            const existing = await transaction.get(ref);
            if (!existing.exists) {
              unlockNotifications.push({
                ref,
                recipientId,
                message: `Clearance application ${appData.applicationNumber} is ready for ${nextStage.label} review.`,
              });
            }
          }
        }
      }

      const summary = getClearanceStatusSummary(
        approvalsSnap.docs.map((doc: QueryDocumentSnapshot) => ({
          status: doc.data().status,
          signatoryRole: doc.data().signatoryRole,
        })),
        data.status,
      );
      const now = new Date().toISOString();

      // Update parent application
      transaction.update(appRef, {
        financialStatus: data.status,
        financialVerifiedAt: now,
        financialRemarks: data.financialRemarks?.trim() || null,
        financialUpdatedBy: accountantId,
        financialUpdatedByName: user.fullName || null,
        overallStatus: summary.overallStatus,
        pendingCount: summary.pendingCount,
        approvedCount: summary.approvedCount,
        notApprovedCount: summary.notApprovedCount,
        printableAvailable: summary.printableAvailable,
        updatedAt: now
      });

      // Write Log
      const logRef = firestore.collection('activityLogs').doc();
      transaction.set(logRef, {
        actorId: accountantId,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'update_financial',
        entityType: 'clearance_application',
        entityId: data.recordId,
        metadata: { status: data.status, financialRemarks: data.financialRemarks?.trim() || null },
        createdAt: now
      });

      // Write Notification
      const notifRef = firestore.collection('notifications').doc();
      transaction.set(notifRef, {
        recipientId: appData.studentUid,
        type: 'financial_updated',
        message: `Your financial accountability has been updated to ${data.status.toUpperCase()} in application ${appData.applicationNumber}.`,
        relatedApplicationId: data.recordId,
        isRead: false,
        createdAt: now
      });

      for (const unlock of unlockNotifications) {
        transaction.set(unlock.ref, {
          recipientId: unlock.recipientId,
          type: 'workflow_stage_unlocked',
          message: unlock.message,
          relatedApplicationId: data.recordId,
          isRead: false,
          createdAt: now,
        });
      }
    });

    return { success: true };
  } catch (error: unknown) {
    logClearanceActionError('updateFinancialStatus', error);
    return { success: false, error: mapClearanceActionError('updateFinancialStatus', error) };
  }
}

// 7. Fetch Dean Clearance Applications Queue (legacy read endpoint)
export async function fetchDeanApplicationsAction() {
  try {
    const { user } = await getAuthenticatedUser();

    if (user.role !== 'dean' && user.role !== 'admin') {
      throw new Error('Unauthorized: Only the Dean can access the academic clearance queue.');
    }

    const firestore = getAdminFirestore();
    const appsQuery = await firestore.collection('clearanceApplications')
      .where('deanApproved', '==', true)
      .orderBy('submittedAt', 'desc')
      .get();

    const deanQueue = appsQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        applicationNumber: data.applicationNumber,
        studentNumber: data.studentNumber,
        studentName: data.studentName,
        program: data.program,
        yearLevel: data.yearLevel,
        section: data.section,
        academicYear: data.academicYear,
        semester: data.semester,
        purpose: data.purpose,
        overallStatus: data.overallStatus,
        financialStatus: data.financialStatus,
        submittedAt: data.submittedAt,
        updatedAt: data.updatedAt
      };
    });

    return { success: true, deanQueue };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Fetch Dean queue error';
    console.error('Fetch Dean queue error:', error);
    return { success: false, error: message };
  }
}

// 8. Fetch Clearance Certificate Details for Printing
export async function fetchClearanceCertificateAction(applicationId: string) {
  try {
    const { uid: userId, user } = await getAuthenticatedUser();

    const firestore = getAdminFirestore();
    const appRef = firestore.collection('clearanceApplications').doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      throw new Error('Clearance application not found.');
    }

    const applicationData = appSnap.data() || {};
    const application = { id: appSnap.id, ...applicationData } as Record<string, unknown>;

    // Check Access Permission (Student owner, Dean, Accountant, or Admin)
    const isOwner = application.studentUid === userId;
    const isStaff = ['admin', 'dean', 'accountant'].includes(user.role);

    if (!isOwner && !isStaff) {
      throw new Error('Unauthorized: You do not have permission to view or print this certificate.');
    }

    const approvalsQuery = await appRef.collection('approvals').get();
    const statusSummary = getClearanceStatusSummary(
      approvalsQuery.docs.map((doc) => ({
        status: doc.data().status,
        signatoryRole: doc.data().signatoryRole,
      })),
      application.financialStatus as string | null | undefined,
    );

    // Derive availability from current approval rows instead of trusting a
    // stale client-visible flag.
    if (!statusSummary.printableAvailable) {
      throw new Error('Certificate Unavailable: Clearance application has not been fully approved yet.');
    }

    // Fetch Approvals
    const reqsQuery = await firestore.collection('clearanceRequirements').get();
    const reqsMap = new Map();
    reqsQuery.forEach((doc) => reqsMap.set(doc.id, doc.data()));

    const activeRoleSet = new Set<string>(REQUIRED_SIGNATORY_ROLES);
    const approvals = approvalsQuery.docs
      .filter((doc) => activeRoleSet.has(String(doc.data().signatoryRole || '')))
      .map((doc) => {
        const data = doc.data();
        const req = reqsMap.get(data.requirementId);
        return {
          id: doc.id,
          signatoryRole: data.signatoryRole,
          label: req?.label || data.signatoryRole,
          status: data.status,
          assignedSignatoryName: data.assignedSignatoryName || 'Department Desk',
          remarksLatest: data.remarksLatest || null,
          actedAt: data.actedAt || null,
          displayOrder: req?.displayOrder || 99,
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return {
      success: true,
      certificateData: {
        application: {
          ...application,
          overallStatus: statusSummary.overallStatus,
          printableAvailable: statusSummary.printableAvailable,
          pendingCount: statusSummary.pendingCount,
          approvedCount: statusSummary.approvedCount,
          notApprovedCount: statusSummary.notApprovedCount,
        },
        approvals,
        issuedAt: application.updatedAt || new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Fetch certificate error';
    console.error('Fetch certificate error:', error);
    return { success: false, error: message };
  }
}


