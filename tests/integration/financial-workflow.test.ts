import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { fetchFinancialQueueAction, updateFinancialStatusAction } from '@/app/actions/clearance';

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
});
