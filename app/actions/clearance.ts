'use server';

import { getAdminFirestore } from '@/lib/firebase/admin';
import { verifySessionCookie } from '@/lib/auth/session';
import { getClearanceStatusSummary } from '@/lib/clearance/status';
import type { QueryDocumentSnapshot, Transaction, DocumentData } from 'firebase-admin/firestore';

// Helper: Verify session and return claims
async function getAuthenticatedUser() {
  return verifySessionCookie();
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
    // Deterministic Application Document ID: {studentUid}_{academicYear}_{semester}
    const cleanAcademicYear = data.academicYear.replace(/\s+/g, '-');
    const cleanSemester = data.semester.replace(/\s+/g, '-');
    const appId = `${studentUid}_${cleanAcademicYear}_${cleanSemester}`;

    // Execute submission in a Firestore Transaction
    await firestore.runTransaction(async (transaction: Transaction) => {
      const appRef = firestore.collection('clearanceApplications').doc(appId);
      const appSnap = await transaction.get(appRef);

      if (appSnap.exists) {
        throw new Error(`Already submitted a clearance application for ${data.academicYear} ${data.semester} Semester.`);
      }

      // Fetch student record for denormalization
      const studentRef = firestore.collection('students').doc(studentUid);
      const studentSnap = await transaction.get(studentRef);

      if (!studentSnap.exists) {
        throw new Error('Student profile record not found. Please contact administration.');
      }

      const student = studentSnap.data()!;

      // Fetch active requirements to initialize approvals
      const reqColRef = firestore.collection('clearanceRequirements');
      const requirementsQuery = await transaction.get(reqColRef.where('isActive', '==', true));
      
      if (requirementsQuery.empty) {
        throw new Error('No active clearance requirements found to initiate checklist.');
      }

      const activeReqs = requirementsQuery.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        return {
          id: doc.id,
          role: data.role as string,
          assignedSignatoryId: (data.assignedSignatoryId as string | null) || null,
          assignedSignatoryName: (data.assignedSignatoryName as string | null) || null,
        };
      });

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
        semester: data.semester,
        purpose: data.purpose,
        overallStatus: 'pending',
        financialStatus: 'pending', // Starts as pending verified
        financialVerifiedAt: null,
        financialRemarks: null,
        financialUpdatedBy: null,
        financialUpdatedByName: null,
        adviserApproved: false,
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
        metadata: { academicYear: data.academicYear, semester: data.semester, purpose: data.purpose },
        createdAt: new Date().toISOString()
      });

      // Add Notification
      const notifRef = firestore.collection('notifications').doc();
      transaction.set(notifRef, {
        recipientId: studentUid,
        type: 'application_submitted',
        message: `Your clearance application ${appNumber} has been successfully submitted.`,
        relatedApplicationId: appId,
        isRead: false,
        createdAt: new Date().toISOString()
      });
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
    const claims = await getAuthenticatedUser();
    const studentUid = claims.uid;

    const firestore = getAdminFirestore();

    // Query latest student application
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

    const approvals = approvalsQuery.docs.map(doc => {
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
    const message = error instanceof Error ? error.message : 'Fetch student dashboard error';
    console.error('Fetch student dashboard action error:', error);
    return { success: false, error: message };
  }
}

// 3. Fetch Pending Approvals Queue (Signatory)
export async function fetchPendingApprovalsAction() {
  try {
    const claims = await getAuthenticatedUser();
    const userId = claims.uid;

    const firestore = getAdminFirestore();

    // Fetch role
    const userDoc = await firestore.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User profile not found.');
    }

    const role = userDoc.data()?.role;
    if (!role || role === 'student') {
      throw new Error('Unauthorized: Student role cannot access evaluator queues.');
    }

    // Query only pending approvals for this role. The parent application is
    // read per result instead of scanning every application document.
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
    const message = error instanceof Error ? error.message : 'Fetch pending approvals error';
    console.error('Fetch pending approvals error:', error);
    return { success: false, error: message };
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
    if (!data.applicationId || !data.approvalId) {
      throw new Error('Application and approval identifiers are required.');
    }
    if (data.status !== 'approved' && (!data.remarks || data.remarks.trim() === '')) {
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
      const adviserApproved = approvalStatuses.some(
        (approval) => approval.signatoryRole === 'adviser' && approval.status === 'approved',
      );
      const now = new Date().toISOString();

      transaction.update(approvalRef, {
        status: data.status,
        remarksLatest: data.remarks || null,
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
        adviserApproved,
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
    const message = error instanceof Error ? error.message : 'Sign clearance error';
    console.error('Sign clearance action error:', error);
    return { success: false, error: message };
  }
}

// 5. Fetch Accountant Financial Queue
export async function fetchFinancialQueueAction() {
  try {
    const claims = await getAuthenticatedUser();
    const userId = claims.uid;

    const firestore = getAdminFirestore();

    // Verify accountant / admin role
    const userDoc = await firestore.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new Error('User profile not found.');
    const role = userDoc.data()?.role;

    if (role !== 'accountant' && role !== 'admin') {
      throw new Error('Unauthorized: Only accountants can access financial accounts.');
    }

    // Query all clearance applications
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
    const message = error instanceof Error ? error.message : 'Fetch financial queue error';
    console.error('Fetch financial queue error:', error);
    return { success: false, error: message };
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

    const firestore = getAdminFirestore();
    // Input validation
    if (data.status === 'unpaid' && (!data.financialRemarks || !data.financialRemarks.trim())) {
      throw new Error("Remarks are required when marking a student as 'unpaid'.");
    }

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
        approvalsSnap.docs.map((doc: QueryDocumentSnapshot) => ({ status: doc.data().status })),
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
    const message = error instanceof Error ? error.message : 'Update financial status error';
    console.error('Update financial status error:', error);
    return { success: false, error: message };
  }
}

// 7. Fetch Dean Clearance Applications Queue (restricted to adviserApproved === true)
export async function fetchDeanApplicationsAction() {
  try {
    const claims = await getAuthenticatedUser();
    const deanId = claims.uid;

    const firestore = getAdminFirestore();

    // Verify role
    const userDoc = await firestore.collection('users').doc(deanId).get();
    if (!userDoc.exists) throw new Error('User profile not found.');
    const user = userDoc.data()!;

    if (user.role !== 'dean' && user.role !== 'admin') {
      throw new Error('Unauthorized: Only the Dean can access the academic clearance queue.');
    }

    // Query applications where adviserApproved === true
    const appsQuery = await firestore.collection('clearanceApplications')
      .where('adviserApproved', '==', true)
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
    const claims = await getAuthenticatedUser();
    const userId = claims.uid;

    const firestore = getAdminFirestore();

    // Fetch User Doc
    const userDoc = await firestore.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new Error('User profile not found.');
    const user = userDoc.data()!;

    // Fetch Clearance Application
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

    const approvals = approvalsQuery.docs
      .map((doc) => {
        const data = doc.data();
        const req = reqsMap.get(data.requirementId);
        return {
          id: doc.id,
          signatoryRole: data.signatoryRole,
          label: req?.label || data.signatoryRole,
          status: data.status,
          assignedSignatoryName: data.assignedSignatoryName || 'Department Desk',
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


