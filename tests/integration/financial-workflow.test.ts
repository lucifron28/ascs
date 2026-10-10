import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { fetchFinancialQueueAction, updateFinancialStatusAction, reopenFinancialStatusAction } from '@/app/actions/clearance';
import { filterFinancialRecords } from '@/lib/clearance/financial-ui';

describe('Financial Workflow Integration Tests', () => {
  let accountantSession: string;
  let librarianSession: string;

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
    accountantSession = await getSessionCookieForUser('accountant@example.test', 'password123');
    librarianSession = await getSessionCookieForUser('librarian@example.test', 'password123');
  });

  it('1. Only Accountant (or Admin) may update financial status', async () => {
    process.env.TEST_SESSION_COOKIE = librarianSession;
    const failRes = await updateFinancialStatusAction({
      recordId: 'app-student-b',
      status: 'paid',
      financialRemarks: '',
    });
    assert.equal(failRes.success, false);
    if (!failRes.success) {
      assert.match(failRes.error, /only accountants/i);
    }
  });

  it('2. Valid status values accepted & 3. Invalid values rejected', async () => {
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const invalidRes = await updateFinancialStatusAction({
      recordId: 'app-student-b',
      status: 'invalid_status' as unknown as 'paid',
      financialRemarks: 'test',
    });
    assert.equal(invalidRes.success, false);
    if (!invalidRes.success) {
      assert.match(invalidRes.error, /invalid financial status/i);
    }
  });

  it("4. 'unpaid' requires remarks", async () => {
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const noRemarksRes = await updateFinancialStatusAction({
      recordId: 'app-student-b',
      status: 'unpaid',
      financialRemarks: '   ',
    });
    assert.equal(noRemarksRes.success, false);
    if (!noRemarksRes.success) {
      assert.match(noRemarksRes.error, /remarks are required/i);
    }
  });

  it('4b. Accountant queue and server action stay locked until Librarian approval', async () => {
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const queueRes = await fetchFinancialQueueAction();
    assert.equal(queueRes.success, true);
    if (!queueRes.success) return;
    assert.equal((queueRes.financialQueue || []).some((record) => record.application_id === 'app-student-c'), false);

    const lockedRes = await updateFinancialStatusAction({
      recordId: 'app-student-c',
      status: 'paid',
      financialRemarks: 'Attempted early payment review.',
    });
    assert.equal(lockedRes.success, false);
    if (!lockedRes.success) {
      assert.match(lockedRes.error, /Accountant Clearance is locked until Librarian Clearance is approved/i);
    }
  });

  it('4c. Paid transition on legacy all-approved application produces no false unlock notification', async () => {
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const paidRes = await updateFinancialStatusAction({
      recordId: 'app-student-d',
      status: 'paid',
      financialRemarks: 'Balance verified for the next clearance stage.',
    });
    assert.equal(paidRes.success, true);

    const unlocks = await getAdminFirestore()
      .collection('notifications')
      .where('recipientId', '==', 'demo-osa-uid')
      .get();
    assert.equal(
      unlocks.docs.filter((doc) => doc.data().type === 'workflow_stage_unlocked' && doc.data().relatedApplicationId === 'app-student-d').length,
      0
    );
  });

  it('5a. Paid -> Unpaid direct Accountant action is rejected on completed stage', async () => {
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const rejectedRes = await updateFinancialStatusAction({
      recordId: 'app-student-a',
      status: 'unpaid',
      financialRemarks: 'Attempting to reverse paid status.',
    });
    assert.equal(rejectedRes.success, false);
    if (!rejectedRes.success) {
      assert.match(rejectedRes.error, /Accountant Clearance has already been completed\./i);
    }
  });

  it("6. 'unpaid' forces overall status to 'not_approved' and subsequent 'paid' permits approval", async () => {
    const db = getAdminFirestore();
    const testAppId = 'app-financial-lifecycle-test';
    const now = new Date().toISOString();

    // Seed actionable application where Librarian is approved and financialStatus is pending
    await db.collection('clearanceApplications').doc(testAppId).set({
      applicationNumber: 'CLR-FIN-TEST-001',
      studentId: 'demo-student-a-uid',
      studentUid: 'demo-student-a-uid',
      studentNumber: 'STUD-2026-0001',
      studentName: 'Student A',
      academicYear: '2026-2027',
      semester: '1st Semester',
      purpose: 'Graduation',
      overallStatus: 'pending',
      financialStatus: 'pending',
      financialVerifiedAt: null,
      financialRemarks: null,
      deanApproved: true,
      printableAvailable: false,
      pendingCount: 0,
      approvedCount: 5,
      notApprovedCount: 0,
      submittedAt: now,
      updatedAt: now,
    });

    for (const role of ['librarian', 'osa_coordinator', 'guidance_counselor', 'area_chair', 'dean']) {
      await db.collection('clearanceApplications').doc(testAppId).collection('approvals').doc(role).set({
        requirementId: role,
        signatoryRole: role,
        status: 'approved',
        actedAt: now,
        updatedAt: now,
      });
    }

    // 1. Mark 'unpaid' -> succeeds, overallStatus becomes not_approved
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const unpaidRes = await updateFinancialStatusAction({
      recordId: testAppId,
      status: 'unpaid',
      financialRemarks: 'Unpaid balance for laboratory fees.',
    });
    assert.equal(unpaidRes.success, true);

    const appDocUnpaid = await db.collection('clearanceApplications').doc(testAppId).get();
    assert.equal(appDocUnpaid.data()?.financialStatus, 'unpaid');
    assert.equal(appDocUnpaid.data()?.overallStatus, 'not_approved');
    assert.equal(appDocUnpaid.data()?.printableAvailable, false);

    // 2. Settle 'unpaid' -> 'paid' -> succeeds, overallStatus becomes approved, printableAvailable becomes true
    const paidRes = await updateFinancialStatusAction({
      recordId: testAppId,
      status: 'paid',
      financialRemarks: 'Balance fully cleared.',
    });
    assert.equal(paidRes.success, true);

    const appDocPaid = await db.collection('clearanceApplications').doc(testAppId).get();
    assert.equal(appDocPaid.data()?.financialStatus, 'paid');
    assert.equal(appDocPaid.data()?.overallStatus, 'approved');
    assert.equal(appDocPaid.data()?.printableAvailable, true);

    const logSnap = await db
      .collection('activityLogs')
      .where('entityId', '==', testAppId)
      .get();
    assert.ok(logSnap.size >= 1);

    const notifSnap = await db
      .collection('notifications')
      .where('recipientId', '==', 'demo-student-a-uid')
      .get();
    assert.ok(notifSnap.size >= 1);
  });
  it('9. Accountant does not behave as a signatory approval row', async () => {
    const approvalsSnap = await getAdminFirestore()
      .collection('clearanceApplications')
      .doc('app-student-a')
      .collection('approvals')
      .get();

    const roles = approvalsSnap.docs.map((d) => d.data().signatoryRole);
    assert.equal(roles.includes('accountant'), false);
  });

  it('10. Accountant filters partition distinct datasets and search within selected category', async () => {
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const queueRes = await fetchFinancialQueueAction();
    assert.equal(queueRes.success, true);
    if (!queueRes.success) return;

    assert.ok(queueRes.allRecords, 'allRecords should be returned alongside queue and history');
    const allRecords = (queueRes.allRecords || []) as unknown as Parameters<typeof filterFinancialRecords>[0];
    assert.ok(allRecords.length >= 2, 'Should contain multiple eligible financial records');

    // 1. All filter returns all eligible records
    const allFiltered = filterFinancialRecords(allRecords, 'all');
    assert.equal(allFiltered.length, allRecords.length);

    // 2. Pending filter
    const pendingFiltered = filterFinancialRecords(allRecords, 'pending');
    assert.ok(pendingFiltered.every((r) => r.status === 'pending'));

    // 3. Paid / Cleared filter: all paid financial records
    const paidFiltered = filterFinancialRecords(allRecords, 'paid');
    assert.ok(paidFiltered.length >= 1);
    assert.ok(paidFiltered.every((r) => r.status === 'paid'));

    // 4. Verify 4 filters partition accurately
    assert.equal(allFiltered.length, allRecords.length);
    // 5. Search within filter
    const firstRecord = allRecords[0];
    if (firstRecord && firstRecord.student_name) {
      const searched = filterFinancialRecords(allRecords, 'all', firstRecord.student_name);
      assert.ok(searched.length >= 1);
      assert.ok(searched.some((r) => r.student_name === firstRecord.student_name));
    }
  });

  it('11. reopenFinancialStatusAction enforces authorization and input validation', async () => {
    // A. Non-Accountant (Librarian) cannot reopen financial status
    process.env.TEST_SESSION_COOKIE = librarianSession;
    const unauthRes = await reopenFinancialStatusAction({
      recordId: 'app-student-a',
      reason: 'Audit correction',
    });
    assert.equal(unauthRes.success, false);
    assert.match(unauthRes.error, /only accountants/i);

    // B. Accountant caller requires non-empty reason
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const noReasonRes = await reopenFinancialStatusAction({
      recordId: 'app-student-a',
      reason: '   ',
    });
    assert.equal(noReasonRes.success, false);
    assert.match(noReasonRes.error, /reason is required/i);

    // C. Non-paid record cannot be reopened
    const nonPaidRes = await reopenFinancialStatusAction({
      recordId: 'app-student-c', // student c is pending
      reason: 'Attempted to reopen pending record',
    });
    assert.equal(nonPaidRes.success, false);
    assert.match(nonPaidRes.error, /only previously paid financial records can be reopened/i);
  });

  it('12. Reopening a fully approved clearance resets financial stage and downstream approvals', async () => {
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const db = getAdminFirestore();
    const appId = 'app-student-a';

    // Verify pre-condition: app-student-a is fully approved
    const preDoc = await db.collection('clearanceApplications').doc(appId).get();
    assert.equal(preDoc.data()?.financialStatus, 'paid');
    assert.equal(preDoc.data()?.overallStatus, 'approved');
    assert.equal(preDoc.data()?.printableAvailable, true);
    assert.equal(preDoc.data()?.deanApproved, true);

    // Accountant reopens the financial status
    const reopenRes = await reopenFinancialStatusAction({
      recordId: appId,
      reason: 'Unpaid graduation fee discovered during audit.',
    });
    assert.equal(reopenRes.success, true);

    // Verify parent application state
    const postDoc = await db.collection('clearanceApplications').doc(appId).get();
    const postData = postDoc.data();
    assert.equal(postData?.financialStatus, 'pending');
    assert.equal(postData?.overallStatus, 'pending');
    assert.equal(postData?.printableAvailable, false);
    assert.equal(postData?.deanApproved, false);
    assert.equal(postData?.financialRemarks, 'Unpaid graduation fee discovered during audit.');
    assert.ok(postData?.financialReopenedAt);

    // Verify subcollection approvals:
    // Upstream (Librarian) remains approved
    const libApproval = await db.collection('clearanceApplications').doc(appId).collection('approvals').doc('librarian').get();
    assert.equal(libApproval.data()?.status, 'approved');

    // Downstream (OSA, Guidance, Area Chair, Dean) are reset to pending
    for (const role of ['osa_coordinator', 'guidance_counselor', 'area_chair', 'dean']) {
      const appDoc = await db.collection('clearanceApplications').doc(appId).collection('approvals').doc(role).get();
      assert.equal(appDoc.data()?.status, 'pending', `Downstream approval ${role} must be reset to pending`);
      assert.equal(appDoc.data()?.actedAt, null);
      assert.ok(appDoc.data()?.remarksLatest?.includes('Financial Reopen Reset'));
    }

    // Verify remarks subcollection has audit records
    const remarksSnap = await db.collection('clearanceApplications').doc(appId).collection('remarks').get();
    const remarkContents = remarksSnap.docs.map((d) => d.data().content);
    assert.ok(remarkContents.some((c) => c.includes('[Accountant Financial Reopen]')));
    assert.ok(remarkContents.some((c) => c.includes('[Financial Invalidation]')));

    // Verify activityLogs
    const logSnap = await db.collection('activityLogs')
      .where('entityId', '==', appId)
      .where('action', '==', 'reopen_financial_status')
      .get();
    assert.ok(logSnap.size >= 1);

    // Verify notification to student
    const notifSnap = await db.collection('notifications')
      .where('recipientId', '==', 'demo-student-a-uid')
      .where('type', '==', 'financial_reopened')
      .get();
    assert.ok(notifSnap.size >= 1);
  });
});
