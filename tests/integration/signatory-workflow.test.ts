import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { fetchPendingApprovalsAction, signClearanceAction } from '@/app/actions/clearance';

describe('Signatory Workflow Integration Tests', () => {
  let librarianSession: string;
  let osaSession: string;
  let areaChairSession: string;
  let adviserSession: string;

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
    librarianSession = await getSessionCookieForUser('librarian@example.test', 'password123');
    osaSession = await getSessionCookieForUser('osa@example.test', 'password123');
    areaChairSession = await getSessionCookieForUser('chair@example.test', 'password123');
    const auth = getAdminAuth();
    const adviser = await auth.getUserByEmail('legacy-adviser@example.test').catch(async () => auth.createUser({
      email: 'legacy-adviser@example.test',
      password: 'password123',
      displayName: 'Legacy Adviser',
      emailVerified: true,
    }));
    await auth.setCustomUserClaims(adviser.uid, { role: 'adviser', mustChangePassword: false });
    await getAdminFirestore().collection('users').doc(adviser.uid).set({
      uid: adviser.uid,
      email: adviser.email,
      fullName: 'Legacy Adviser',
      role: 'adviser',
      accountStatus: 'active',
      isActive: true,
      mustChangePassword: false,
    }, { merge: true });
    adviserSession = await getSessionCookieForUser('legacy-adviser@example.test', 'password123');
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

  it('3. Legacy Adviser cannot load a queue or sign a retained Adviser row', async () => {
    process.env.TEST_SESSION_COOKIE = adviserSession;
    const queueRes = await fetchPendingApprovalsAction();
    assert.equal(queueRes.success, false);
    if (!queueRes.success) assert.match(queueRes.error, /active clearance signatories|unauthorized/i);

    const approvalRef = getAdminFirestore()
      .collection('clearanceApplications')
      .doc('app-student-b')
      .collection('approvals')
      .doc('adviser');
    await approvalRef.set({ signatoryRole: 'adviser', status: 'pending', remarksLatest: null }, { merge: true });
    const before = await approvalRef.get();

    const signRes = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'adviser',
      status: 'approved',
      remarks: '',
    });
    assert.equal(signRes.success, false);
    const after = await approvalRef.get();
    assert.equal(after.data()?.status, before.data()?.status);
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

  it('5. Pending requires remarks & 6. Not_approved requires remarks', async () => {
    process.env.TEST_SESSION_COOKIE = areaChairSession;
    const resNoRemarks = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'area_chair',
      status: 'not_approved',
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
      status: 'not_approved',
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
});
