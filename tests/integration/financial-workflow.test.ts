import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { updateFinancialStatusAction } from '@/app/actions/clearance';

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

  it("6. 'unpaid' forces overall status to 'not_approved'", async () => {
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const unpaidRes = await updateFinancialStatusAction({
      recordId: 'app-student-a',
      status: 'unpaid',
      financialRemarks: 'Unpaid balance for laboratory fees.',
    });
    assert.equal(unpaidRes.success, true);

    const appDoc = await getAdminFirestore().collection('clearanceApplications').doc('app-student-a').get();
    assert.equal(appDoc.data()?.financialStatus, 'unpaid');
    assert.equal(appDoc.data()?.overallStatus, 'not_approved');
    assert.equal(appDoc.data()?.printableAvailable, false);
  });

  it("5. 'paid' status permits approval when all signatories are approved & 7. Activity log & 8. Notification", async () => {
    process.env.TEST_SESSION_COOKIE = accountantSession;
    const paidRes = await updateFinancialStatusAction({
      recordId: 'app-student-a',
      status: 'paid',
      financialRemarks: 'Balance fully cleared.',
    });
    assert.equal(paidRes.success, true);

    const appDoc = await getAdminFirestore().collection('clearanceApplications').doc('app-student-a').get();
    assert.equal(appDoc.data()?.financialStatus, 'paid');
    assert.equal(appDoc.data()?.overallStatus, 'approved');
    assert.equal(appDoc.data()?.printableAvailable, true);

    const logSnap = await getAdminFirestore()
      .collection('activityLogs')
      .where('entityId', '==', 'app-student-a')
      .get();
    assert.ok(logSnap.size >= 1);

    const notifSnap = await getAdminFirestore()
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
