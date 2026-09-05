import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import {
  fetchPendingApprovalsAction,
  signClearanceAction,
  submitApplicationAction,
  updateFinancialStatusAction,
} from '@/app/actions/clearance';

interface SeedApplicationOptions {
  id: string;
  financialStatus: 'pending' | 'paid' | 'unpaid';
  financialRemarks?: string | null;
  approvals: Partial<
    Record<
      'librarian' | 'osa_coordinator' | 'guidance_counselor' | 'area_chair' | 'dean',
      {
        status: 'pending' | 'approved' | 'not_approved';
        assignedSignatoryId?: string | null;
        assignedSignatoryName?: string | null;
        remarksLatest?: string | null;
      }
    >
  >;
  studentUid?: string;
  academicYear?: string;
  semester?: string;
}

async function seedTestApplication(options: SeedApplicationOptions): Promise<string> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const appRef = db.collection('clearanceApplications').doc(options.id);

  const roles = [
    'librarian',
    'osa_coordinator',
    'guidance_counselor',
    'area_chair',
    'dean',
  ] as const;

  let pendingCount = 0;
  let approvedCount = 0;
  let notApprovedCount = 0;

  for (const role of roles) {
    const appVal = options.approvals[role] || { status: 'pending' };
    if (appVal.status === 'approved') approvedCount++;
    else if (appVal.status === 'not_approved') notApprovedCount++;
    else pendingCount++;
  }

  const overallStatus =
    options.financialStatus === 'unpaid' || notApprovedCount > 0
      ? 'not_approved'
      : approvedCount === 5 && options.financialStatus === 'paid'
      ? 'approved'
      : 'pending';

  await appRef.set({
    applicationNumber: `CLR-TEST-${options.id}`,
    studentId: options.studentUid || 'demo-student-a-uid',
    studentUid: options.studentUid || 'demo-student-a-uid',
    studentNumber: 'STUD-2026-0001',
    studentName: 'Test Student',
    academicYear: options.academicYear || '2026-2027',
    semester: options.semester || '1st Semester',
    purpose: 'Graduation',
    overallStatus,
    financialStatus: options.financialStatus,
    financialVerifiedAt: options.financialStatus !== 'pending' ? now : null,
    financialRemarks: options.financialRemarks ?? (options.financialStatus === 'paid' ? 'Paid in full' : null),
    financialUpdatedBy: options.financialStatus !== 'pending' ? 'demo-accountant-uid' : null,
    financialUpdatedByName: options.financialStatus !== 'pending' ? 'Accountant Officer' : null,
    deanApproved: options.approvals.dean?.status === 'approved',
    printableAvailable: overallStatus === 'approved',
    pendingCount,
    approvedCount,
    notApprovedCount,
    submittedAt: now,
    updatedAt: now,
  });

  for (const role of roles) {
    const appVal = options.approvals[role] || { status: 'pending' };
    const defaultSignatoryId =
      role === 'librarian'
        ? 'demo-librarian-uid'
        : role === 'osa_coordinator'
        ? 'demo-osa-uid'
        : role === 'guidance_counselor'
        ? 'demo-guidance-uid'
        : role === 'area_chair'
        ? 'demo-chair-uid'
        : 'demo-dean-uid';

    const defaultSignatoryName =
      role === 'librarian'
        ? 'Librarian Officer'
        : role === 'osa_coordinator'
        ? 'OSA Coordinator'
        : role === 'guidance_counselor'
        ? 'Guidance Counselor'
        : role === 'area_chair'
        ? 'Area Chair'
        : 'Dean of Business Program';

    await appRef.collection('approvals').doc(role).set({
      requirementId: role,
      signatoryRole: role,
      assignedSignatoryId:
        appVal.assignedSignatoryId !== undefined ? appVal.assignedSignatoryId : defaultSignatoryId,
      assignedSignatoryName:
        appVal.assignedSignatoryName !== undefined ? appVal.assignedSignatoryName : defaultSignatoryName,
      status: appVal.status,
      remarksLatest: appVal.remarksLatest ?? null,
      actedAt: appVal.status !== 'pending' ? now : null,
      updatedAt: now,
    });
  }

  return options.id;
}

describe('Sequential Clearance Workflow Repairs Integration Tests', () => {
  let accountantSession: string;
  let librarianSession: string;
  let osaUserASession: string;
  let osaUserBSession: string;
  let studentESession: string;
  let studentGSession: string;
  const userAId = 'demo-osa-uid';
  const userBId = 'demo-osa-b-uid';

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();

    const auth = getAdminAuth();
    const db = getAdminFirestore();

    accountantSession = await getSessionCookieForUser('accountant@example.test', 'password123');
    librarianSession = await getSessionCookieForUser('librarian@example.test', 'password123');
    osaUserASession = await getSessionCookieForUser('osa@example.test', 'password123');

    // Create User B (OSA Coordinator B)
    const userB = await auth.getUserByEmail('osa-b@example.test').catch(async () =>
      auth.createUser({
        uid: userBId,
        email: 'osa-b@example.test',
        password: 'password123',
        displayName: 'OSA Coordinator B',
      })
    );
    await auth.setCustomUserClaims(userB.uid, { role: 'osa_coordinator', mustChangePassword: false });
    await db.collection('users').doc(userB.uid).set(
      {
        uid: userB.uid,
        email: 'osa-b@example.test',
        fullName: 'OSA Coordinator B',
        role: 'osa_coordinator',
        accountStatus: 'active',
        isActive: true,
        mustChangePassword: false,
      },
      { merge: true }
    );
    osaUserBSession = await getSessionCookieForUser('osa-b@example.test', 'password123');

    // Ensure Student E and Student G can authenticate without forced password change
    await db.collection('users').doc('demo-student-e-uid').update({
      mustChangePassword: false,
    });
    studentESession = await getSessionCookieForUser('student.e@example.test', 'password123');

    await db.collection('users').doc('demo-student-g-uid').update({
      mustChangePassword: false,
    });
    studentGSession = await getSessionCookieForUser('student.g@example.test', 'password123');
  });

  it('1. Paid -> Unpaid direct Accountant action rejected', async () => {
    const recordId = 'test-repair-paid-to-unpaid';
    await seedTestApplication({
      id: recordId,
      financialStatus: 'paid',
      approvals: {
        librarian: { status: 'approved' },
        osa_coordinator: { status: 'pending' },
        guidance_counselor: { status: 'pending' },
        area_chair: { status: 'pending' },
        dean: { status: 'pending' },
      },
    });

    process.env.TEST_SESSION_COOKIE = accountantSession;
    const res = await updateFinancialStatusAction({
      recordId,
      status: 'unpaid',
      financialRemarks: 'Hold',
    });

    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /Accountant Clearance has already been completed\./i);
    }
  });

  it('2. Paid -> Paid repeated action rejected', async () => {
    const recordId = 'test-repair-paid-to-paid';
    await seedTestApplication({
      id: recordId,
      financialStatus: 'paid',
      approvals: {
        librarian: { status: 'approved' },
        osa_coordinator: { status: 'pending' },
        guidance_counselor: { status: 'pending' },
        area_chair: { status: 'pending' },
        dean: { status: 'pending' },
      },
    });

    process.env.TEST_SESSION_COOKIE = accountantSession;
    const res = await updateFinancialStatusAction({
      recordId,
      status: 'paid',
      financialRemarks: '',
    });

    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /Accountant Clearance has already been completed\./i);
    }
  });

  it('3. Unpaid -> Paid succeeds when Stage 2 is current', async () => {
    const recordId = 'test-repair-unpaid-to-paid';
    await seedTestApplication({
      id: recordId,
      financialStatus: 'unpaid',
      financialRemarks: 'Prior hold on account.',
      approvals: {
        librarian: { status: 'approved' },
        osa_coordinator: { status: 'pending' },
        guidance_counselor: { status: 'pending' },
        area_chair: { status: 'pending' },
        dean: { status: 'pending' },
      },
    });

    process.env.TEST_SESSION_COOKIE = accountantSession;
    const res = await updateFinancialStatusAction({
      recordId,
      status: 'paid',
      financialRemarks: '',
    });

    assert.equal(res.success, true);

    const appDoc = await getAdminFirestore().collection('clearanceApplications').doc(recordId).get();
    assert.equal(appDoc.data()?.financialStatus, 'paid');
  });

  it('4. Legacy out-of-order notification test', async () => {
    const recordId = 'test-repair-legacy-out-of-order';
    await seedTestApplication({
      id: recordId,
      financialStatus: 'unpaid',
      financialRemarks: 'Historical unpaid tuition balance.',
      approvals: {
        librarian: { status: 'approved' },
        osa_coordinator: { status: 'approved' },
        guidance_counselor: { status: 'approved' },
        area_chair: { status: 'approved' },
        dean: { status: 'approved' },
      },
    });

    process.env.TEST_SESSION_COOKIE = accountantSession;
    const res = await updateFinancialStatusAction({
      recordId,
      status: 'paid',
      financialRemarks: '',
    });

    assert.equal(res.success, true);

    const notificationsSnap = await getAdminFirestore()
      .collection('notifications')
      .where('relatedApplicationId', '==', recordId)
      .get();

    const stageUnlockNotifs = notificationsSnap.docs.filter((doc) => {
      const data = doc.data();
      return data.type === 'workflow_stage_unlocked' || doc.id.startsWith(`unlock-${recordId}-`);
    });

    assert.equal(stageUnlockNotifs.length, 0);

    const recipientIds = stageUnlockNotifs.map((d) => d.data().recipientId);
    assert.equal(recipientIds.includes('demo-osa-uid'), false);
    assert.equal(recipientIds.includes('demo-guidance-uid'), false);
    assert.equal(recipientIds.includes('demo-chair-uid'), false);
    assert.equal(recipientIds.includes('demo-dean-uid'), false);
  });

  it('5. Application assignment-drift regression test', async () => {
    // Submit application as Student E
    process.env.TEST_SESSION_COOKIE = studentESession;
    const submitRes = await submitApplicationAction({
      academicYear: '2026-2027',
      semester: '2nd Semester',
      purpose: 'Evaluation',
    });
    assert.equal(submitRes.success, true);
    if (!submitRes.success) return;

    const recordId = submitRes.applicationId;
    assert.ok(recordId);

    const db = getAdminFirestore();

    // Verify the OSA approval row was assigned to User A (initial global requirement)
    const initialOsaApproval = await db
      .collection('clearanceApplications')
      .doc(recordId)
      .collection('approvals')
      .doc('osa_coordinator')
      .get();
    assert.equal(initialOsaApproval.data()?.assignedSignatoryId, userAId);

    // Librarian approves Stage 1 to make Stage 2 (Accountant) actionable
    process.env.TEST_SESSION_COOKIE = librarianSession;
    const libRes = await signClearanceAction({
      applicationId: recordId,
      approvalId: 'librarian',
      status: 'approved',
      remarks: 'Librarian clearance granted.',
    });
    assert.equal(libRes.success, true);

    try {
      // Update global clearanceRequirements/osa_coordinator to point to User B
      await db.collection('clearanceRequirements').doc('osa_coordinator').set(
        {
          assignedSignatoryId: userBId,
          assignedSignatoryName: 'OSA Coordinator B',
        },
        { merge: true }
      );

      // Transition Accountant from pending to paid
      process.env.TEST_SESSION_COOKIE = accountantSession;
      const paidRes = await updateFinancialStatusAction({
        recordId,
        status: 'paid',
        financialRemarks: 'Payment completed.',
      });
      assert.equal(paidRes.success, true);

      // Assert unlock notification was sent to User A, NOT User B
      const notifsSnap = await db
        .collection('notifications')
        .where('relatedApplicationId', '==', recordId)
        .where('type', '==', 'workflow_stage_unlocked')
        .get();

      const unlockRecipients = notifsSnap.docs.map((doc) => doc.data().recipientId);
      assert.ok(unlockRecipients.includes(userAId), 'User A should receive unlock notification');
      assert.equal(unlockRecipients.includes(userBId), false, 'User B should NOT receive unlock notification');

      // Assert User A's OSA queue contains the application
      process.env.TEST_SESSION_COOKIE = osaUserASession;
      const userAQueue = await fetchPendingApprovalsAction();
      assert.equal(userAQueue.success, true);
      if (userAQueue.success && userAQueue.pendingQueue) {
        const userAHasApp = userAQueue.pendingQueue.some(
          (item) => (item as { application_id?: string }).application_id === recordId
        );
        assert.equal(userAHasApp, true, "User A's pending queue should contain the application");
      }

      // Assert User B's OSA queue does NOT contain the application
      process.env.TEST_SESSION_COOKIE = osaUserBSession;
      const userBQueue = await fetchPendingApprovalsAction();
      assert.equal(userBQueue.success, true);
      if (userBQueue.success && userBQueue.pendingQueue) {
        const userBHasApp = userBQueue.pendingQueue.some(
          (item) => (item as { application_id?: string }).application_id === recordId
        );
        assert.equal(userBHasApp, false, "User B's pending queue should NOT contain the application");
      }
    } finally {
      // Restore global requirement back to User A
      await db.collection('clearanceRequirements').doc('osa_coordinator').set(
        {
          assignedSignatoryId: userAId,
          assignedSignatoryName: 'OSA Coordinator',
        },
        { merge: true }
      );
    }
  });

  it('6. Signatory not_approved -> approved direct mutation rejected', async () => {
    const applicationId = 'test-repair-finalized-not-approved';
    await seedTestApplication({
      id: applicationId,
      financialStatus: 'pending',
      approvals: {
        librarian: { status: 'not_approved', remarksLatest: 'Unreturned library books' },
        osa_coordinator: { status: 'pending' },
        guidance_counselor: { status: 'pending' },
        area_chair: { status: 'pending' },
        dean: { status: 'pending' },
      },
    });

    process.env.TEST_SESSION_COOKIE = librarianSession;
    const res = await signClearanceAction({
      applicationId,
      approvalId: 'librarian',
      status: 'approved',
      remarks: 'Reconsider',
    });

    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /This clearance decision has already been finalized\./i);
    }
  });

  it('7. Signatory approved -> pending or not_approved direct mutation rejected', async () => {
    const applicationId = 'test-repair-finalized-approved';
    await seedTestApplication({
      id: applicationId,
      financialStatus: 'pending',
      approvals: {
        librarian: { status: 'approved', remarksLatest: 'All books returned' },
        osa_coordinator: { status: 'pending' },
        guidance_counselor: { status: 'pending' },
        area_chair: { status: 'pending' },
        dean: { status: 'pending' },
      },
    });

    process.env.TEST_SESSION_COOKIE = librarianSession;

    // Attempt mutation from approved -> pending
    const pendingRes = await signClearanceAction({
      applicationId,
      approvalId: 'librarian',
      status: 'pending',
      remarks: 'Reverting back to pending review.',
    });
    assert.equal(pendingRes.success, false);
    if (!pendingRes.success) {
      assert.match(pendingRes.error, /This clearance decision has already been finalized\./i);
    }

    // Attempt mutation from approved -> not_approved
    const notApprovedRes = await signClearanceAction({
      applicationId,
      approvalId: 'librarian',
      status: 'not_approved',
      remarks: 'Direct reversal to rejected.',
    });
    assert.equal(notApprovedRes.success, false);
    if (!notApprovedRes.success) {
      assert.match(notApprovedRes.error, /This clearance decision has already been finalized\./i);
    }
  });

  it('8. Five approval-row invariant verified', async () => {
    process.env.TEST_SESSION_COOKIE = studentGSession;
    const submitRes = await submitApplicationAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
      purpose: 'Graduation',
    });

    assert.equal(submitRes.success, true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    assert.ok(appId);

    const approvalsSnap = await getAdminFirestore()
      .collection('clearanceApplications')
      .doc(appId)
      .collection('approvals')
      .get();

    assert.equal(approvalsSnap.size, 5);

    const approvalRoles = approvalsSnap.docs.map((doc) => doc.data().signatoryRole).sort();
    assert.deepEqual(approvalRoles, [
      'area_chair',
      'dean',
      'guidance_counselor',
      'librarian',
      'osa_coordinator',
    ]);

    assert.equal(approvalRoles.includes('accountant'), false);
    assert.equal(approvalRoles.includes('adviser'), false);

    const requirementIds = approvalsSnap.docs.map((doc) => doc.id).sort();
    assert.deepEqual(requirementIds, [
      'area_chair',
      'dean',
      'guidance_counselor',
      'librarian',
      'osa_coordinator',
    ]);
  });
});
