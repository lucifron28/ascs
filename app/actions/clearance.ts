'use server';

import { getAdminFirestore } from '@/lib/firebase/admin';
import { normalizeSemester, getApplicationTermDocumentIds } from '@/lib/academic-term';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getClearanceStatusSummary, REQUIRED_SIGNATORY_ROLES } from '@/lib/clearance/status';
import { logClearanceActionError, mapClearanceActionError } from '@/lib/clearance/action-errors';
import type { QueryDocumentSnapshot, Transaction, DocumentData } from 'firebase-admin/firestore';

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

      // Fetch active requirements to initialize approvals (excluding accountant)
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
        .filter((req) => (REQUIRED_SIGNATORY_ROLES as readonly string[]).includes(req.role));

      if (activeReqs.length === 0) {
        throw new Error('No active clearance signatory requirements are configured.');
      }

      // Gather signatory notification targets within transaction read phase
      const signatoryNotifications: Array<{ recipientId: string; reqLabel: string }> = [];
      const notifiedRecipients = new Set<string>();

      for (const req of activeReqs) {
        if (req.assignedSignatoryId) {
          if (!notifiedRecipients.has(req.assignedSignatoryId) && req.assignedSignatoryId !== studentUid) {
            notifiedRecipients.add(req.assignedSignatoryId);
            signatoryNotifications.push({ recipientId: req.assignedSignatoryId, reqLabel: req.label });
          }
        } else {
          const matchingUsersSnap = await transaction.get(
            firestore.collection('users')
              .where('role', '==', req.role)
              .where('accountStatus', '==', 'active')
          );
          for (const userDoc of matchingUsersSnap.docs) {
            const recipientId = userDoc.id;
            if (!notifiedRecipients.has(recipientId) && recipientId !== studentUid) {
              notifiedRecipients.add(recipientId);
              signatoryNotifications.push({ recipientId, reqLabel: req.label });
            }
          }
        }
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

      // Add Signatory Notifications
      for (const sigNotif of signatoryNotifications) {
        const sigNotifRef = firestore.collection('notifications').doc();
        transaction.set(sigNotifRef, {
          recipientId: sigNotif.recipientId,
          type: 'signatory_action_required',
          message: `A new clearance application ${appNumber} from ${student.fullName} requires ${sigNotif.reqLabel} review.`,
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
    const statusSummary = getClearanceStatusSummary(
      approvalsQuery.docs.map((doc) => ({ status: doc.data().status, signatoryRole: doc.data().signatoryRole })),
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
      financial
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
      .get();
    const pendingQueue: Array<Record<string, unknown>> = [];

    for (const approvalDoc of approvalsQuery.docs) {
      const approvalData = approvalDoc.data();
      if (approvalData.signatoryRole !== role) continue;
      if (approvalData.assignedSignatoryId && approvalData.assignedSignatoryId !== userId) continue;

      const appRef = approvalDoc.ref.parent.parent;
      if (!appRef) continue;
      const appSnap = await appRef.get();
      if (!appSnap.exists) continue;
      const appData = appSnap.data()!;

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
        student_name: appData.studentName
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

      const approvalStatuses: Array<{ status: string; signatoryRole?: string }> = approvalsSnap.docs.map((doc: QueryDocumentSnapshot) => ({
        status: doc.id === data.approvalId ? data.status : doc.data().status,
        signatoryRole: doc.id === data.approvalId ? approvalData.signatoryRole : doc.data().signatoryRole,
      }));
      const summary = getClearanceStatusSummary(approvalStatuses, appData.financialStatus);
      const deanRows = approvalStatuses.filter((approval) => approval.signatoryRole === 'dean');
      const deanApproved = deanRows.length > 0 && deanRows.every((approval) => approval.status === 'approved');
      const now = new Date().toISOString();

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
    const financialQueue = appsQuery.docs.map(doc => {
      const data = doc.data();
      return {
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
        student_id_number: data.studentNumber
      };
    });

    return { success: true, financialQueue };
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

function formatRoleName(role: string) {
  return role.replace('_', ' ').toUpperCase();
}


