import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { updateUserRoleAction } from '@/app/actions/admin';
import { registerStudentAccountAction } from '@/app/actions/registration';
import {
  createStudentAccountAction,
  createStaffAccountAction,
  deactivateUserAccountAction,
  reactivateUserAccountAction,
  resetUserTemporaryPasswordAction,
} from '@/app/actions/admin-accounts';
import { fetchSignatoryCandidatesAction } from '@/app/actions/admin';

describe('Account Lifecycle Integration Tests', () => {
  let adminSession: string;

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
    adminSession = await getSessionCookieForUser('admin@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = adminSession;
  });

  it('1. Admin can create a student account with synchronized Auth & Firestore', async () => {
    const studentData = {
      email: 'newstudent@example.test',
      fullName: 'New Student One',
      studentNumber: 'STUD-2026-9991',
      program: 'BSAIS',
      yearLevel: '1st Year',
      section: 'A',
      contactNumber: '09123456789',
    };

    const res = await createStudentAccountAction(studentData);
    assert.equal(res.success, true);
    if (!res.success) return;

    const uid = res.user.uid;

    const authUser = await getAdminAuth().getUser(uid);
    assert.equal(authUser.email, studentData.email);
    assert.equal(authUser.customClaims?.role, 'student');
    assert.equal(authUser.customClaims?.mustChangePassword, true);

    const userDoc = await getAdminFirestore().collection('users').doc(uid).get();
    assert.equal(userDoc.exists, true);
    assert.equal(userDoc.data()?.role, 'student');
    assert.equal(userDoc.data()?.mustChangePassword, true);
    assert.equal(userDoc.data()?.accountStatus, 'active');

    const publicDoc = await getAdminFirestore().collection('publicUsers').doc(uid).get();
    assert.equal(publicDoc.exists, true);
    assert.equal(publicDoc.data()?.role, 'student');

    const studentDoc = await getAdminFirestore().collection('students').doc(uid).get();
    assert.equal(studentDoc.exists, true);
    assert.equal(studentDoc.data()?.studentNumber, studentData.studentNumber);
    assert.equal(studentDoc.data()?.program, 'BSAIS');
  });

  it('2. Admin can create a staff account without creating a student profile', async () => {
    const staffData = {
      email: 'newlibrarian@example.test',
      fullName: 'New Librarian Staff',
      role: 'librarian' as const,
      contactNumber: '09123456789',
    };

    const res = await createStaffAccountAction(staffData);
    assert.equal(res.success, true);
    if (!res.success) return;

    const uid = res.user.uid;

    const authUser = await getAdminAuth().getUser(uid);
    assert.equal(authUser.customClaims?.role, 'librarian');

    const userDoc = await getAdminFirestore().collection('users').doc(uid).get();
    assert.equal(userDoc.data()?.role, 'librarian');

    const publicDoc = await getAdminFirestore().collection('publicUsers').doc(uid).get();
    assert.equal(publicDoc.exists, true);
    assert.equal(publicDoc.data()?.role, 'librarian');

    const candidates = await fetchSignatoryCandidatesAction('librarian');
    assert.equal(candidates.success, true);
    if (candidates.success) {
      assert.ok((candidates.candidates || []).some((candidate) => candidate.uid === uid));
    }

    const studentDoc = await getAdminFirestore().collection('students').doc(uid).get();
    assert.equal(studentDoc.exists, false);
  });

  it('3. Student can self-register with a fixed student role and synchronized profile', async () => {
    const registrationData = {
      email: 'selfregistered@example.test',
      fullName: 'Self Registered Student',
      studentNumber: 'STUD-2026-9992',
      program: 'BSAIS',
      yearLevel: '1st Year',
      section: 'A',
      contactNumber: '09123456789',
      password: 'student-password',
      confirmPassword: 'student-password',
    };

    const res = await registerStudentAccountAction(registrationData);
    assert.equal(res.success, true);
    if (!res.success) return;

    const uid = res.user.uid;
    const authUser = await getAdminAuth().getUser(uid);
    assert.equal(authUser.customClaims?.role, 'student');
    assert.equal(authUser.customClaims?.mustChangePassword, false);

    const userDoc = await getAdminFirestore().collection('users').doc(uid).get();
    assert.equal(userDoc.data()?.createdBy, 'self_registration');
    assert.equal(userDoc.data()?.mustChangePassword, false);

    const studentDoc = await getAdminFirestore().collection('students').doc(uid).get();
    assert.equal(studentDoc.data()?.studentNumber, registrationData.studentNumber);
    assert.equal(studentDoc.data()?.program, registrationData.program);

    const auditLogs = await getAdminFirestore()
      .collection('activityLogs')
      .where('action', '==', 'self_register_student_account')
      .get();
    const auditData = auditLogs.docs.find((doc) => doc.data().entityId === uid)?.data();
    assert.ok(auditData, 'Self-registration should create an audit record');
    assert.equal((auditData?.metadata as Record<string, unknown>)?.password, undefined);
  });

  it('6. Duplicate account creation fails safely', async () => {
    const duplicateData = {
      email: 'student.a@example.test',
      fullName: 'Duplicate Student',
      studentNumber: 'STUD-2026-0001',
      program: 'BSAIS',
      yearLevel: '1st Year',
      section: 'A',
      contactNumber: '09123456789',
    };

    const res = await createStudentAccountAction(duplicateData);
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /already registered/i);
    }
  });

  it('7. Temporary password flag is created correctly & 13. Password reset sets mustChangePassword', async () => {
    const res = await resetUserTemporaryPasswordAction({ userId: 'demo-student-a-uid' });
    assert.equal(res.success, true);

    const userDoc = await getAdminFirestore().collection('users').doc('demo-student-a-uid').get();
    assert.equal(userDoc.data()?.mustChangePassword, true);

    const authUser = await getAdminAuth().getUser('demo-student-a-uid');
    assert.equal(authUser.customClaims?.mustChangePassword, true);
  });

  it('8. Deactivation disables Auth & updates Firestore, 9. Reactivation re-enables Auth & Firestore', async () => {
    const targetUid = 'demo-student-b-uid';

    const deactRes = await deactivateUserAccountAction({ userId: targetUid });
    assert.equal(deactRes.success, true);

    const authDisabled = await getAdminAuth().getUser(targetUid);
    assert.equal(authDisabled.disabled, true);

    const userDisabled = await getAdminFirestore().collection('users').doc(targetUid).get();
    assert.equal(userDisabled.data()?.accountStatus, 'inactive');
    assert.equal(userDisabled.data()?.isActive, false);

    const reactRes = await reactivateUserAccountAction({ userId: targetUid });
    assert.equal(reactRes.success, true);

    const authEnabled = await getAdminAuth().getUser(targetUid);
    assert.equal(authEnabled.disabled, false);

    const userEnabled = await getAdminFirestore().collection('users').doc(targetUid).get();
    assert.equal(userEnabled.data()?.accountStatus, 'active');
    assert.equal(userEnabled.data()?.isActive, true);
  });

  it('10. Final active Admin cannot be deactivated', async () => {
    const res = await deactivateUserAccountAction({ userId: 'demo-admin-uid' });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /deactivation|administrator|own account/i);
    }
  });

  it('11. Final active Admin cannot be demoted via updateUserRoleAction', async () => {
    const res = await updateUserRoleAction({
      userId: 'demo-admin-uid',
      newRole: 'librarian',
    });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /final active administrator|role demotion|own account/i);
    }

    const userDoc = await getAdminFirestore().collection('users').doc('demo-admin-uid').get();
    assert.equal(userDoc.data()?.role, 'admin');
    assert.equal(userDoc.data()?.accountStatus, 'active');

    const authUser = await getAdminAuth().getUser('demo-admin-uid');
    assert.equal(authUser.customClaims?.role, 'admin');
  });

  it('12. Student -> staff conversion is rejected via updateUserRoleAction', async () => {
    const res = await updateUserRoleAction({
      userId: 'demo-student-a-uid',
      newRole: 'librarian',
    });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /student.*staff|role conversion/i);
    }

    const userDoc = await getAdminFirestore().collection('users').doc('demo-student-a-uid').get();
    assert.equal(userDoc.data()?.role, 'student');

    const studentDoc = await getAdminFirestore().collection('students').doc('demo-student-a-uid').get();
    assert.equal(studentDoc.exists, true);

    const authUser = await getAdminAuth().getUser('demo-student-a-uid');
    assert.equal(authUser.customClaims?.role, 'student');
  });

  it('12b. Staff -> student conversion is rejected via updateUserRoleAction', async () => {
    const res = await updateUserRoleAction({
      userId: 'demo-librarian-uid',
      newRole: 'student',
    });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /student.*staff|role conversion/i);
    }

    const userDoc = await getAdminFirestore().collection('users').doc('demo-librarian-uid').get();
    assert.equal(userDoc.data()?.role, 'librarian');

    const studentDoc = await getAdminFirestore().collection('students').doc('demo-librarian-uid').get();
    assert.equal(studentDoc.exists, false);

    const authUser = await getAdminAuth().getUser('demo-librarian-uid');
    assert.equal(authUser.customClaims?.role, 'librarian');
  });

  it('14. Inactive user cannot authenticate normally', async () => {
    const authUser = await getAdminAuth().getUser('demo-student-f-uid');
    assert.equal(authUser.disabled, true);

    const userDoc = await getAdminFirestore().collection('users').doc('demo-student-f-uid').get();
    assert.equal(userDoc.data()?.accountStatus, 'inactive');
  });
});
