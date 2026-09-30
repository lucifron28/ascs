import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  fetchPendingApprovalsAction,
  fetchApprovedHistoryAction,
  signClearanceAction,
  reopenClearanceAction,
} from '@/app/actions/clearance';

describe('Signatory Workflow Integration Tests', () => {
  let librarianSession: string;
  let osaSession: string;
  let areaChairSession: string;
  let nonSignatorySession: string;

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
    librarianSession = await getSessionCookieForUser('librarian@example.test', 'password123');
    osaSession = await getSessionCookieForUser('osa@example.test', 'password123');
    areaChairSession = await getSessionCookieForUser('chair@example.test', 'password123');
    nonSignatorySession = await getSessionCookieForUser('student.b@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = librarianSession;
  });

  it('1. Correct role sees applicable pending work', async () => {
    process.env.TEST_SESSION_COOKIE = librarianSession;
    const queueRes = await fetchPendingApprovalsAction();
    assert.equal(queueRes.success, true);
    if (!queueRes.success) return;

    assert.equal(queueRes.role, 'librarian');
    assert.ok(Array.isArray(queueRes.pendingQueue));
  });

  it('1b. A later signatory cannot bypass an unresolved earlier stage', async () => {
    process.env.TEST_SESSION_COOKIE = osaSession;
    const queueRes = await fetchPendingApprovalsAction();
    assert.equal(queueRes.success, true);
    if (!queueRes.success) return;
    assert.equal((queueRes.pendingQueue || []).some((item) => item.application_id === 'app-student-c'), false);

    const res = await signClearanceAction({
      applicationId: 'app-student-c',
      approvalId: 'osa_coordinator',
      status: 'approved',
      remarks: '',
    });
    assert.equal(res.success, false);
    if (!res.success) assert.match(res.error || '', /stage is locked until the previous stage/i);
  });

  it('2. Wrong role cannot approve another requirement', async () => {
    process.env.TEST_SESSION_COOKIE = librarianSession;
    const res = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'osa_coordinator',
      status: 'approved',
      remarks: '',
    });

    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /department mismatch|unauthorized/i);
    }
  });

  it('3. Non-signatory role cannot load a queue or sign an approval row, and no Adviser row exists', async () => {
    process.env.TEST_SESSION_COOKIE = nonSignatorySession;
    const queueRes = await fetchPendingApprovalsAction();
    assert.equal(queueRes.success, false);
    if (!queueRes.success) assert.match(queueRes.error, /active clearance signatories|unauthorized/i);

    const signRes = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'librarian',
      status: 'approved',
      remarks: '',
    });
    assert.equal(signRes.success, false);

    const approvalsSnap = await getAdminFirestore()
      .collection('clearanceApplications')
      .doc('app-student-b')
      .collection('approvals')
      .get();
    assert.equal(approvalsSnap.docs.some((doc) => doc.id === 'adviser' || doc.data().signatoryRole === 'adviser'), false);
    assert.equal(approvalsSnap.size, 5);
  });

  it('4. Approved works & 10. Status summary recalculates correctly', async () => {
    const guidanceSession = await getSessionCookieForUser('guidance@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = guidanceSession;

    const res = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'guidance_counselor',
      status: 'approved',
      remarks: '',
    });

    assert.equal(res.success, true);

    const appDoc = await getAdminFirestore().collection('clearanceApplications').doc('app-student-b').get();
    assert.equal(appDoc.data()?.approvedCount, 3); // was 2, now 3

    const areaChairUnlocks = await getAdminFirestore()
      .collection('notifications')
      .where('recipientId', '==', 'demo-chair-uid')
      .get();
    assert.equal(areaChairUnlocks.docs.filter((doc) => doc.data().type === 'workflow_stage_unlocked' && doc.data().relatedApplicationId === 'app-student-b').length, 1);
  });

  it('5. Pending requires remarks', async () => {
    process.env.TEST_SESSION_COOKIE = areaChairSession;
    const resNoRemarks = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'area_chair',
      status: 'pending',
      remarks: '   ',
    });

    assert.equal(resNoRemarks.success, false);
    if (!resNoRemarks.success) {
      assert.match(resNoRemarks.error, /remarks are required/i);
    }
  });

  it('7. Remarks history is persisted & 8. Activity log persisted & 9. Student notification created', async () => {
    process.env.TEST_SESSION_COOKIE = areaChairSession;
    const resWithRemarks = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'area_chair',
      status: 'pending',
      remarks: 'Area Chair review requires an updated clearance note.',
    });

    assert.equal(resWithRemarks.success, true);

    const remarksSnap = await getAdminFirestore()
      .collection('clearanceApplications')
      .doc('app-student-b')
      .collection('remarks')
      .get();
    assert.ok(remarksSnap.size >= 1);
    const latestRemark = remarksSnap.docs[remarksSnap.size - 1].data();
    assert.equal(latestRemark.content, 'Area Chair review requires an updated clearance note.');

    const logsSnap = await getAdminFirestore()
      .collection('activityLogs')
      .where('entityId', '==', 'area_chair')
      .get();
    assert.ok(logsSnap.size >= 1);

    const notifsSnap = await getAdminFirestore()
      .collection('notifications')
      .where('recipientId', '==', 'demo-student-b-uid')
      .get();
    assert.ok(notifsSnap.size >= 1);

    const deanUnlocks = await getAdminFirestore()
      .collection('notifications')
      .where('recipientId', '==', 'demo-dean-uid')
      .get();
    assert.equal(deanUnlocks.docs.filter((doc) => doc.data().type === 'workflow_stage_unlocked' && doc.data().relatedApplicationId === 'app-student-b').length, 0);
  });

  it('10. Direct Not Approved action is rejected by server action', async () => {
    process.env.TEST_SESSION_COOKIE = areaChairSession;
    const res = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'area_chair',
      status: 'not_approved' as never,
      remarks: 'Attempting not approved',
    });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /invalid clearance approval status/i);
    }
  });

  it('11. fetchApprovedHistoryAction returns approved applications for signatory', async () => {
    process.env.TEST_SESSION_COOKIE = librarianSession;
    const historyRes = await fetchApprovedHistoryAction();
    assert.equal(historyRes.success, true);
    if (historyRes.success) {
      assert.ok(Array.isArray(historyRes.approvedHistory));
      assert.ok(historyRes.approvedHistory.some((item) => item.student_id_number === 'STUD-2026-0001'));
    }
  });

  it('12. reopenClearanceAction returns approved requirement to pending and recomputes overall status', async () => {
    process.env.TEST_SESSION_COOKIE = librarianSession;
    const reopenRes = await reopenClearanceAction({
      applicationId: 'app-student-a',
      approvalId: 'librarian',
      remarks: 'Accidental approval corrected - student has unreturned library book.',
    });
    assert.equal(reopenRes.success, true);

    const appDoc = await getAdminFirestore().collection('clearanceApplications').doc('app-student-a').get();
    assert.equal(appDoc.data()?.overallStatus, 'pending');
    assert.equal(appDoc.data()?.printableAvailable, false);
    assert.equal(appDoc.data()?.approvedCount, 4);
    assert.equal(appDoc.data()?.pendingCount, 1);

    const approvalDoc = await getAdminFirestore().collection('clearanceApplications').doc('app-student-a').collection('approvals').doc('librarian').get();
    assert.equal(approvalDoc.data()?.status, 'pending');
    assert.equal(approvalDoc.data()?.remarksLatest, 'Accidental approval corrected - student has unreturned library book.');

    // Unauthorized role cannot reopen
    process.env.TEST_SESSION_COOKIE = osaSession;
    const failReopen = await reopenClearanceAction({
      applicationId: 'app-student-a',
      approvalId: 'librarian',
      remarks: 'Wrong role attempting reopen',
    });
    assert.equal(failReopen.success, false);
  });
});
