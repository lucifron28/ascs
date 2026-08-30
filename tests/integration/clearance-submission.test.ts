import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { submitApplicationAction, signClearanceAction } from '@/app/actions/clearance';

describe('Clearance Submission Integration Tests', () => {
  let studentESession: string;

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
    // Student E is a fresh fixture account (temporary password cleared for submission testing)
    await getAdminFirestore().collection('users').doc('demo-student-e-uid').update({
      mustChangePassword: false,
    });
    studentESession = await getSessionCookieForUser('student.e@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = studentESession;
  });

  it('1. Student may submit clearance application & 3. Contains denormalized fields & 4. Financial status pending', async () => {
    // Submit for 2026-2027 Summer term
    const submitRes = await submitApplicationAction({
      academicYear: '2026-2027',
      semester: 'Summer',
      purpose: 'Evaluation',
    });

    assert.equal(submitRes.success, true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    assert.ok(appId);

    const appDoc = await getAdminFirestore().collection('clearanceApplications').doc(appId).get();
    assert.equal(appDoc.exists, true);
    const data = appDoc.data();

    assert.equal(data?.studentUid, 'demo-student-e-uid');
    assert.equal(data?.studentNumber, 'STUD-2026-0005');
    assert.equal(data?.studentName, 'Student E (Temp Pass)');
    assert.equal(data?.academicYear, '2026-2027');
    assert.equal(data?.semester, 'Summer Semester');
    assert.equal(data?.purpose, 'Evaluation');
    assert.equal(data?.financialStatus, 'pending'); // Initial financial status
    assert.equal(data?.overallStatus, 'pending');

    // 5. Required approval rows are created & 6. Accountant row is not created
    const approvalsSnap = await getAdminFirestore()
      .collection('clearanceApplications')
      .doc(appId)
      .collection('approvals')
      .get();

    assert.equal(approvalsSnap.size, 5); // 5 signatories
    const approvalRoles = approvalsSnap.docs.map((d) => d.data().signatoryRole);
    assert.equal(approvalRoles.includes('accountant'), false); // No accountant approval row

    // 7. Student submission notification & 8. Signatory notifications created
    const studentNotifs = await getAdminFirestore()
      .collection('notifications')
      .where('recipientId', '==', 'demo-student-e-uid')
      .get();
    assert.ok(studentNotifs.size >= 1);

    const signatoryNotifs = await getAdminFirestore()
      .collection('notifications')
      .where('relatedApplicationId', '==', appId)
      .where('type', '==', 'signatory_action_required')
      .get();
    assert.deepEqual(
      signatoryNotifs.docs.map((doc) => doc.data().recipientId),
      ['demo-librarian-uid'],
    );

    // 9. Activity log created
    const logsSnap = await getAdminFirestore()
      .collection('activityLogs')
      .where('entityId', '==', appId)
      .get();
    assert.equal(logsSnap.size, 1);
    assert.equal(logsSnap.docs[0].data().action, 'submitted_application');
    assert.equal(logsSnap.docs[0].data().metadata?.semester, 'Summer Semester');
  });

  it('2. Duplicate same-term application fails', async () => {
    const dupRes = await submitApplicationAction({
      academicYear: '2026-2027',
      semester: 'Summer',
      purpose: 'Evaluation',
    });
    assert.equal(dupRes.success, false);
    if (!dupRes.success) {
      assert.match(dupRes.error, /already submitted/i);
    }
  });
  it('11. Legacy semester alias submission is persisted as canonical and prevents alias duplicate', async () => {
    process.env.TEST_SESSION_COOKIE = studentESession;

    // Submit using legacy alias '1st'
    const submitRes = await submitApplicationAction({
      academicYear: '2027-2028',
      semester: '1st',
      purpose: 'Enrollment',
    });

    assert.equal(submitRes.success, true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    assert.equal(appId, 'demo-student-e-uid_2027-2028_1st-Semester');

    const appDoc = await getAdminFirestore().collection('clearanceApplications').doc(appId).get();
    assert.equal(appDoc.exists, true);
    const data = appDoc.data();

    assert.equal(data?.semester, '1st Semester');

    const logsSnap = await getAdminFirestore()
      .collection('activityLogs')
      .where('entityId', '==', appId)
      .get();
    assert.equal(logsSnap.size, 1);
    assert.equal(logsSnap.docs[0].data().metadata?.semester, '1st Semester');

    // Duplicate submission using canonical '1st Semester' must fail
    const dupRes = await submitApplicationAction({
      academicYear: '2027-2028',
      semester: '1st Semester',
      purpose: 'Enrollment',
    });
    assert.equal(dupRes.success, false);
    if (!dupRes.success) {
      assert.match(dupRes.error, /already submitted/i);
    }
  });

  it('12. Existing legacy document ID prevents new canonical submission', async () => {
    process.env.TEST_SESSION_COOKIE = studentESession;

    const legacyAppId = 'demo-student-e-uid_2028-2029_1st';
    await getAdminFirestore().collection('clearanceApplications').doc(legacyAppId).set({
      studentUid: 'demo-student-e-uid',
      academicYear: '2028-2029',
      semester: '1st',
      purpose: 'Enrollment',
      overallStatus: 'pending',
      financialStatus: 'pending',
      submittedAt: new Date().toISOString(),
    });

    const dupRes = await submitApplicationAction({
      academicYear: '2028-2029',
      semester: '1st Semester',
      purpose: 'Enrollment',
    });
    assert.equal(dupRes.success, false);
    if (!dupRes.success) {
      assert.match(dupRes.error, /already submitted/i);
    }
  });

  it('10. Another student cannot act on an application (wrong role / wrong ownership)', async () => {
    process.env.TEST_SESSION_COOKIE = studentESession;
    // Attempting to sign as Student E for Student B's application must fail
    const invalidSignRes = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'librarian',
      status: 'approved',
      remarks: '',
    });
    assert.equal(invalidSignRes.success, false);
    if (!invalidSignRes.success) {
      assert.match(invalidSignRes.error, /unauthorized|department mismatch/i);
    }
  });
});
