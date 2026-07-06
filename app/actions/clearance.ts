'use server';

import { cookies } from 'next/headers';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';

// Helper: Verify session and return claims
async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) {
    throw new Error('Unauthorized: No session cookie found.');
  }

  try {
    return await getAdminAuth().verifySessionCookie(session, true);
  } catch (error) {
    throw new Error('Unauthorized: Invalid session.');
  }
}

// 1. Submit Clearance Application (Student)
export async function submitApplicationAction(data: {
  academicYear: string;
  semester: string;
  purpose: string;
}) {
  try {
    const claims = await getAuthenticatedUser();
    const studentUid = claims.uid;

    const firestore = getAdminFirestore();
    
    // Check user role from Firestore users collection
    const userDoc = await firestore.collection('users').doc(studentUid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'student') {
      throw new Error('Unauthorized: Only students can submit clearance applications.');
    }

    // Deterministic Application Document ID: {studentUid}_{academicYear}_{semester}
    const cleanAcademicYear = data.academicYear.replace(/\s+/g, '-');
    const cleanSemester = data.semester.replace(/\s+/g, '-');
    const appId = `${studentUid}_${cleanAcademicYear}_${cleanSemester}`;

    // Execute submission in a Firestore Transaction
    await firestore.runTransaction(async (transaction) => {
      const appRef = firestore.collection('clearanceApplications').doc(appId);
      const appSnap = (await transaction.get(appRef)) as any;

      if (appSnap.exists) {
        throw new Error(`Already submitted a clearance application for ${data.academicYear} ${data.semester} Semester.`);
      }

      // Fetch student record for denormalization
      const studentRef = firestore.collection('students').doc(studentUid);
      const studentSnap = (await transaction.get(studentRef)) as any;

      if (!studentSnap.exists) {
        throw new Error('Student profile record not found. Please contact administration.');
      }

      const student = studentSnap.data()!;

      // Fetch active requirements to initialize approvals
      const reqColRef = firestore.collection('clearanceRequirements');
      const requirementsQuery = await reqColRef.where('isActive', '==', true).get();
      
      if (requirementsQuery.empty) {
        throw new Error('No active clearance requirements found to initiate checklist.');
      }

      const activeReqs = requirementsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

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
        financialNotes: null,
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
  } catch (error: any) {
    console.error('Submit application action error:', error);
    return { success: false, error: error.message };
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
    const application = { id: appDoc.id, ...appDoc.data() } as any;

    // Fetch approvals subcollection
    const approvalsQuery = await appDoc.ref.collection('approvals').get();
    
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
        ...data,
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
      status: application.financialStatus,
      notes: application.financialNotes || null,
      verified_at: application.financialVerifiedAt
    };

    return {
      success: true,
      application,
      approvals,
      remarks,
      financial
    };
  } catch (error: any) {
    console.error('Fetch student dashboard action error:', error);
    return { success: false, error: error.message };
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

    // Fetch all active clearance applications
    const appsQuery = await firestore.collection('clearanceApplications').get();
    const pendingQueue: any[] = [];

    // Iterate through applications and query approvals subcollections
    for (const appDoc of appsQuery.docs) {
      const appData = appDoc.data();
      const approvalsQuery = await appDoc.ref.collection('approvals')
        .where('signatoryRole', '==', role)
        .where('status', '==', 'pending')
        .get();

      approvalsQuery.forEach(apprDoc => {
        const apprData = apprDoc.data();
        // Signatory can see it if it is unassigned or assigned specifically to them
        if (!apprData.assignedSignatoryId || apprData.assignedSignatoryId === userId) {
          pendingQueue.push({
            approval_id: apprDoc.id,
            signatory_role: apprData.signatoryRole,
            status: apprData.status,
            application_id: appDoc.id,
            application_number: appData.applicationNumber,
            academic_year: appData.academicYear,
            semester: appData.semester,
            purpose: appData.purpose,
            submitted_at: appData.submittedAt,
            student_id_number: appData.studentNumber,
            student_name: appData.studentName
          });
        }
      });
    }

    // Sort by submission date ascending (oldest first)
    pendingQueue.sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());

    return { success: true, role, pendingQueue };
  } catch (error: any) {
    console.error('Fetch pending approvals error:', error);
    return { success: false, error: error.message };
  }
}

// 4. Sign/Action Clearance Approval (Signatory)
export async function signClearanceAction(data: {
  approvalId: string;
  status: 'approved' | 'pending' | 'not_approved';
  remarks: string;
}) {
  try {
    const claims = await getAuthenticatedUser();
    const signatoryId = claims.uid;

    const firestore = getAdminFirestore();

    // Get Signatory Profile
    const userDoc = await firestore.collection('users').doc(signatoryId).get();
    if (!userDoc.exists) throw new Error('Signatory profile not found.');
    const user = userDoc.data()!;

    // Enforce remarks validation
    if (data.status !== 'approved' && (!data.remarks || data.remarks.trim() === '')) {
      throw new Error('Remarks are required when marking an approval as pending or not approved.');
    }

    // Locate the clearance application holding this approval
    // Iterate to find the application containing the approvals subcollection document
    const appsQuery = await firestore.collection('clearanceApplications').get();
    let parentAppDoc: any = null;
    let approvalRef: any = null;

    for (const doc of appsQuery.docs) {
      const apprDoc = await doc.ref.collection('approvals').doc(data.approvalId).get();
      if (apprDoc.exists) {
        parentAppDoc = doc;
        approvalRef = apprDoc.ref;
        break;
      }
    }

    if (!parentAppDoc || !approvalRef) {
      throw new Error('Clearance approval record not found.');
    }

    // Run update in transaction
    await firestore.runTransaction(async (transaction) => {
      const appRef = parentAppDoc.ref;
      const appSnap = (await transaction.get(appRef)) as any;
      const approvalSnap = (await transaction.get(approvalRef)) as any;

      const appData = appSnap.data()!;
      const approvalData = approvalSnap.data()!;

      // Verify assignee role match
      if (approvalData.signatoryRole !== user.role) {
        throw new Error('Unauthorized: Evaluator department mismatch.');
      }

      // Update approval document
      transaction.update(approvalRef, {
        status: data.status,
        remarksLatest: data.remarks || null,
        assignedSignatoryId: signatoryId,
        assignedSignatoryName: user.fullName,
        actedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Write remark log
      if (data.remarks && data.remarks.trim() !== '') {
        const remarkRef = appRef.collection('remarks').doc();
        transaction.set(remarkRef, {
          approvalId: data.approvalId,
          authorId: signatoryId,
          authorName: user.fullName,
          authorRole: user.role,
          content: data.remarks,
          createdAt: new Date().toISOString()
        });
      }

      // Fetch all approvals to calculate overall status
      const approvalsColRef = appRef.collection('approvals');
      const approvalsQuery = await approvalsColRef.get(); // Note: inside transactions, read-only queries should technically be before writes. But in Node SDK, gets are permitted if transaction get is used. We can fetch approvals inside the transaction:
      
      let pendingCount = 0;
      let approvedCount = 0;
      let notApprovedCount = 0;

      // Re-read approvals inside the transaction loop
      for (const doc of approvalsQuery.docs) {
        let status = doc.data().status;
        // Adjust status if it is the current updated one
        if (doc.id === data.approvalId) {
          status = data.status;
        }

        if (status === 'approved') approvedCount++;
        else if (status === 'not_approved') notApprovedCount++;
        else pendingCount++;
      }

      // Overall status evaluation logic
      let finalStatus = 'pending';
      const financialStatus = appData.financialStatus;

      if (notApprovedCount > 0) {
        finalStatus = 'not_approved';
      } else if (pendingCount === 0) {
        if (financialStatus === 'paid') {
          finalStatus = 'approved';
        } else if (financialStatus === 'unpaid') {
          finalStatus = 'not_approved'; // Unpaid holds overall approval
        } else {
          finalStatus = 'pending'; // Pending financial verification blocks
        }
      }

      const isAdviserApproval = approvalData.signatoryRole === 'adviser' && data.status === 'approved';
      
      transaction.update(appRef, {
        overallStatus: finalStatus,
        pendingCount,
        approvedCount,
        notApprovedCount,
        adviserApproved: appData.adviserApproved || isAdviserApproval,
        printableAvailable: finalStatus === 'approved',
        updatedAt: new Date().toISOString()
      });

      // Write Activity Log
      const logRef = firestore.collection('activityLogs').doc();
      transaction.set(logRef, {
        actorId: signatoryId,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'approval_action',
        entityType: 'clearance_approval',
        entityId: data.approvalId,
        metadata: { status: data.status, remarks: data.remarks },
        createdAt: new Date().toISOString()
      });

      // Write Student Notification
      const notifRef = firestore.collection('notifications').doc();
      transaction.set(notifRef, {
        recipientId: appData.studentUid,
        type: 'approval_updated',
        message: `Your approval for ${formatRoleName(approvalData.signatoryRole)} has been marked as ${data.status.replace('_', ' ')}.`,
        relatedApplicationId: parentAppDoc.id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error('Sign clearance action error:', error);
    return { success: false, error: error.message };
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
        notes: data.financialNotes || null,
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
  } catch (error: any) {
    console.error('Fetch financial queue error:', error);
    return { success: false, error: error.message };
  }
}

// 6. Update Student Financial Status (Accountant)
export async function updateFinancialStatusAction(data: {
  recordId: string; // matches application ID
  status: 'paid' | 'unpaid';
  notes: string;
}) {
  try {
    const claims = await getAuthenticatedUser();
    const accountantId = claims.uid;

    const firestore = getAdminFirestore();

    // Verify role
    const userDoc = await firestore.collection('users').doc(accountantId).get();
    if (!userDoc.exists) throw new Error('User profile not found.');
    const user = userDoc.data()!;

    if (user.role !== 'accountant' && user.role !== 'admin') {
      throw new Error('Unauthorized: Only accountants can modify financial status.');
    }

    const appRef = firestore.collection('clearanceApplications').doc(data.recordId);

    await firestore.runTransaction(async (transaction) => {
      const appSnap = (await transaction.get(appRef)) as any;
      if (!appSnap.exists) {
        throw new Error('Clearance application not found.');
      }

      const appData = appSnap.data()!;

      // Fetch approvals subcollection to calculate overall status
      const approvalsColRef = appRef.collection('approvals');
      const approvalsQuery = await approvalsColRef.get();
      
      let pendingCount = 0;
      let approvedCount = 0;
      let notApprovedCount = 0;

      approvalsQuery.forEach(doc => {
        const status = doc.data().status;
        if (status === 'approved') approvedCount++;
        else if (status === 'not_approved') notApprovedCount++;
        else pendingCount++;
      });

      // Overall status evaluation logic
      let finalStatus = 'pending';
      if (notApprovedCount > 0) {
        finalStatus = 'not_approved';
      } else if (pendingCount === 0) {
        if (data.status === 'paid') {
          finalStatus = 'approved';
        } else if (data.status === 'unpaid') {
          finalStatus = 'not_approved';
        } else {
          finalStatus = 'pending';
        }
      }

      // Update parent application
      transaction.update(appRef, {
        financialStatus: data.status,
        financialVerifiedAt: new Date().toISOString(),
        financialNotes: data.notes || null,
        overallStatus: finalStatus,
        printableAvailable: finalStatus === 'approved',
        updatedAt: new Date().toISOString()
      });

      // Write Log
      const logRef = firestore.collection('activityLogs').doc();
      transaction.set(logRef, {
        actorId: accountantId,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'update_financial',
        entityType: 'financial_record',
        entityId: data.recordId,
        metadata: { status: data.status, notes: data.notes },
        createdAt: new Date().toISOString()
      });

      // Write Notification
      const notifRef = firestore.collection('notifications').doc();
      transaction.set(notifRef, {
        recipientId: appData.studentUid,
        type: 'financial_updated',
        message: `Your financial accountability has been updated to ${data.status.toUpperCase()} in application ${appData.applicationNumber}.`,
        relatedApplicationId: data.recordId,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error('Update financial status error:', error);
    return { success: false, error: error.message };
  }
}

function formatRoleName(role: string) {
  return role.replace('_', ' ').toUpperCase();
}
