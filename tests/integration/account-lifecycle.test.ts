import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import {
  createStudentAccountAction,
  createStaffAccountAction,
  deactivateUserAccountAction,
  reactivateUserAccountAction,
  resetUserTemporaryPasswordAction,
} from '@/app/actions/admin-accounts';

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
      program: 'BSIT',
      yearLevel: '1st Year',
      section: 'A',
      contactNumber: '09123456789',
    };

    const res = await createStudentAccountAction(studentData);
    assert.equal(res.success, true);
    if (!res.success) return;

    const uid = res.user.uid;

    // Check Auth
    const authUser = await getAdminAuth().getUser(uid);
    assert.equal(authUser.email, studentData.email);
    assert.equal(authUser.customClaims?.role, 'student');
    assert.equal(authUser.customClaims?.mustChangePassword, true);

    // Check Firestore users
    const userDoc = await getAdminFirestore().collection('users').doc(uid).get();
    assert.equal(userDoc.exists, true);
    assert.equal(userDoc.data()?.role, 'student');
    assert.equal(userDoc.data()?.mustChangePassword, true);
    assert.equal(userDoc.data()?.accountStatus, 'active');

    // Check Firestore publicUsers
    const publicDoc = await getAdminFirestore().collection('publicUsers').doc(uid).get();
    assert.equal(publicDoc.exists, true);
    assert.equal(publicDoc.data()?.role, 'student');

    // Check Firestore students profile (requirement 4)
    const studentDoc = await getAdminFirestore().collection('students').doc(uid).get();
    assert.equal(studentDoc.exists, true);
    assert.equal(studentDoc.data()?.studentNumber, studentData.studentNumber);
    assert.equal(studentDoc.data()?.program, 'BSIT');
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

    // Check Auth & Firestore
    const authUser = await getAdminAuth().getUser(uid);
    assert.equal(authUser.customClaims?.role, 'librarian');

    const userDoc = await getAdminFirestore().collection('users').doc(uid).get();
    assert.equal(userDoc.data()?.role, 'librarian');

    // Verify staff account does NOT create a student record (requirement 5)
    const studentDoc = await getAdminFirestore().collection('students').doc(uid).get();
    assert.equal(studentDoc.exists, false);
  });

  it('6. Duplicate account creation fails safely', async () => {
    const duplicateData = {
      email: 'student.a@example.test', // Already exists in seeded fixtures
      fullName: 'Duplicate Student',
      studentNumber: 'STUD-2026-0001', // Already exists
      program: 'BSIT',
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

    // Deactivate
    const deactRes = await deactivateUserAccountAction({ userId: targetUid });
    assert.equal(deactRes.success, true);

    const authDisabled = await getAdminAuth().getUser(targetUid);
    assert.equal(authDisabled.disabled, true);

    const userDisabled = await getAdminFirestore().collection('users').doc(targetUid).get();
    assert.equal(userDisabled.data()?.accountStatus, 'inactive');
    assert.equal(userDisabled.data()?.isActive, false);

    // Reactivate
    const reactRes = await reactivateUserAccountAction({ userId: targetUid });
    assert.equal(reactRes.success, true);

    const authEnabled = await getAdminAuth().getUser(targetUid);
    assert.equal(authEnabled.disabled, false);

    const userEnabled = await getAdminFirestore().collection('users').doc(targetUid).get();
    assert.equal(userEnabled.data()?.accountStatus, 'active');
    assert.equal(userEnabled.data()?.isActive, true);
  });

  it('10. Final active Admin cannot be deactivated', async () => {
    // Only 1 admin in seed fixtures: demo-admin-uid
    const res = await deactivateUserAccountAction({ userId: 'demo-admin-uid' });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error, /deactivation|administrator|own account/i);
    }
  });

  it('14. Inactive user cannot authenticate normally', async () => {
    // demo-student-f-uid is inactive
    const authUser = await getAdminAuth().getUser('demo-student-f-uid');
    assert.equal(authUser.disabled, true);

    const userDoc = await getAdminFirestore().collection('users').doc('demo-student-f-uid').get();
    assert.equal(userDoc.data()?.accountStatus, 'inactive');
  });
});
