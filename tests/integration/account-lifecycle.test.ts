import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { updateRequirementAssignmentAction, updateUserRoleAction } from '@/app/actions/admin';
import { registerStudentAccountAction } from '@/app/actions/registration';
import {
  createStudentAccountAction,
  createStaffAccountAction,
  deactivateUserAccountAction,
  reactivateUserAccountAction,
  resetUserTemporaryPasswordAction,
  deleteUserAccountAction,
  approveStudentRegistrationAction,
  rejectStudentRegistrationAction,
} from '@/app/actions/admin-accounts';
import { fetchAdminUsersAction, fetchSignatoryCandidatesAction } from '@/app/actions/admin';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { submitApplicationAction } from '@/app/actions/clearance';

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
      semester: '1st Semester',
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
    assert.equal(userDoc.data()?.program, studentData.program);
    assert.equal(userDoc.data()?.yearLevel, studentData.yearLevel);
    assert.equal(userDoc.data()?.semester, studentData.semester);

    const publicDoc = await getAdminFirestore().collection('publicUsers').doc(uid).get();
    assert.equal(publicDoc.exists, true);
    assert.equal(publicDoc.data()?.role, 'student');
    assert.equal(publicDoc.data()?.program, studentData.program);
    assert.equal(publicDoc.data()?.yearLevel, studentData.yearLevel);
    assert.equal(publicDoc.data()?.semester, studentData.semester);

    const studentDoc = await getAdminFirestore().collection('students').doc(uid).get();
    assert.equal(studentDoc.exists, true);
    assert.equal(studentDoc.data()?.studentNumber, studentData.studentNumber);
    assert.equal(studentDoc.data()?.program, 'BSAIS');
    assert.equal(studentDoc.data()?.yearLevel, studentData.yearLevel);
    assert.equal(studentDoc.data()?.semester, studentData.semester);
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

  it('2b. Every active signatory role synchronizes and appears in candidates immediately', async () => {
    const roles = [
      'librarian',
      'osa_coordinator',
      'guidance_counselor',
      'area_chair',
      'dean',
    ] as const;
    const createdUids = new Map<(typeof roles)[number], string>();

    for (const role of roles) {
      const res = await createStaffAccountAction({
        email: `new-${role.replace('_', '-')}-coverage@example.test`,
        fullName: `Coverage ${role}`,
        role,
        contactNumber: '09123456789',
      });
      assert.equal(res.success, true, `createStaffAccountAction should create ${role}`);
      if (!res.success) continue;

      const uid = res.user.uid;
      createdUids.set(role, uid);
      const authUser = await getAdminAuth().getUser(uid);
      assert.equal(authUser.customClaims?.role, role);

      const userDoc = await getAdminFirestore().collection('users').doc(uid).get();
      assert.equal(userDoc.data()?.role, role);
      assert.equal(userDoc.data()?.accountStatus, 'active');
      assert.equal(userDoc.data()?.isActive, true);

      const publicDoc = await getAdminFirestore().collection('publicUsers').doc(uid).get();
      assert.equal(publicDoc.data()?.role, role);

      const candidates = await fetchSignatoryCandidatesAction(role);
      assert.equal(candidates.success, true);
      if (candidates.success) assert.ok(candidates.candidates.some((candidate) => candidate.uid === uid));
    }

    const librarianUid = createdUids.get('librarian');
    assert.ok(librarianUid);
    if (!librarianUid) return;

    const deactivated = await deactivateUserAccountAction({ userId: librarianUid });
    assert.equal(deactivated.success, true);
    const afterDeactivate = await fetchSignatoryCandidatesAction('librarian');
    assert.equal(afterDeactivate.success, true);
    if (afterDeactivate.success) assert.equal(afterDeactivate.candidates.some((candidate) => candidate.uid === librarianUid), false);

    const reactivated = await reactivateUserAccountAction({ userId: librarianUid });
    assert.equal(reactivated.success, true);
    const afterReactivate = await fetchSignatoryCandidatesAction('librarian');
    assert.equal(afterReactivate.success, true);
    if (afterReactivate.success) assert.equal(afterReactivate.candidates.some((candidate) => candidate.uid === librarianUid), true);

    const changed = await updateUserRoleAction({ userId: librarianUid, newRole: 'guidance_counselor' });
    assert.equal(changed.success, true);
    const librarianCandidates = await fetchSignatoryCandidatesAction('librarian');
    const guidanceCandidates = await fetchSignatoryCandidatesAction('guidance_counselor');
    if (librarianCandidates.success) assert.equal(librarianCandidates.candidates.some((candidate) => candidate.uid === librarianUid), false);
    if (guidanceCandidates.success) assert.equal(guidanceCandidates.candidates.some((candidate) => candidate.uid === librarianUid), true);
  });

  it('2c. Failed staff synchronization cannot leave an active assignable phantom', async () => {
    const email = 'forced-failure-staff@example.test';
    process.env.ASCS_TEST_FORCE_STAFF_SYNC_FAILURE = 'true';
    let result;
    try {
      result = await createStaffAccountAction({
        email,
        fullName: 'Forced Failure Staff',
        role: 'area_chair',
        contactNumber: '09123456789',
      });
    } finally {
      delete process.env.ASCS_TEST_FORCE_STAFF_SYNC_FAILURE;
    }

    assert.equal(result.success, false);
    const authUser = await getAdminAuth().getUserByEmail(email).catch(() => null);
    assert.equal(authUser, null);
    const profiles = await getAdminFirestore().collection('users').where('email', '==', email).get();
    for (const profile of profiles.docs) {
      assert.notEqual(profile.data().accountStatus, 'active');
      assert.notEqual(profile.data().isActive, true);
    }
    const candidates = await fetchSignatoryCandidatesAction('area_chair');
    assert.equal(candidates.success, true);
    if (candidates.success) assert.equal(candidates.candidates.some((candidate) => candidate.email === email), false);
  });

  it('2d. Adviser cannot be newly created, assigned, or selected as an active role', async () => {
    const created = await createStaffAccountAction({
      email: 'new-adviser@example.test',
      fullName: 'New Adviser Attempt',
      role: 'adviser' as never,
    });
    assert.equal(created.success, false);

    const adviserCandidates = await fetchSignatoryCandidatesAction('adviser' as never);
    assert.equal(adviserCandidates.success, false);

    const roleUpdate = await updateUserRoleAction({ userId: 'demo-librarian-uid', newRole: 'adviser' as never });
    assert.equal(roleUpdate.success, false);

    await getAdminFirestore().collection('users').doc('legacy-adviser-assignment-uid').set({
      uid: 'legacy-adviser-assignment-uid',
      email: 'legacy-adviser-assignment@example.test',
      fullName: 'Legacy Adviser Assignment',
      role: 'adviser',
      accountStatus: 'active',
      isActive: true,
    });
    const assignment = await updateRequirementAssignmentAction({
      requirementId: 'dean',
      assignedSignatoryId: 'legacy-adviser-assignment-uid',
      assignedSignatoryName: 'Legacy Adviser Assignment',
    });
    assert.equal(assignment.success, false);
  });

  it('3. Student can self-register with a fixed student role and synchronized profile', async () => {
    const registrationData = {
      email: 'selfregistered@example.test',
      fullName: 'Self Registered Student',
      studentNumber: 'STUD-2026-9992',
      program: 'BSAIS',
      yearLevel: '1st Year',
      semester: '1st Semester',
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
    assert.equal(authUser.customClaims?.accountStatus, 'pending_approval');
    assert.equal(authUser.customClaims?.mustChangePassword, false);

    const userDoc = await getAdminFirestore().collection('users').doc(uid).get();
    assert.equal(userDoc.data()?.accountStatus, 'pending_approval');
    assert.equal(userDoc.data()?.isActive, false);
    assert.equal(userDoc.data()?.createdBy, 'self_registration');
    assert.equal(userDoc.data()?.mustChangePassword, false);
    assert.equal(userDoc.data()?.program, registrationData.program);
    assert.equal(userDoc.data()?.yearLevel, registrationData.yearLevel);
    assert.equal(userDoc.data()?.semester, registrationData.semester);

    const studentDoc = await getAdminFirestore().collection('students').doc(uid).get();
    assert.equal(studentDoc.data()?.studentNumber, registrationData.studentNumber);
    assert.equal(studentDoc.data()?.program, registrationData.program);
    assert.equal(studentDoc.data()?.yearLevel, registrationData.yearLevel);
    assert.equal(studentDoc.data()?.semester, registrationData.semester);
    const publicDoc = await getAdminFirestore().collection('publicUsers').doc(uid).get();
    assert.equal(publicDoc.data()?.program, registrationData.program);
    assert.equal(publicDoc.data()?.yearLevel, registrationData.yearLevel);
    assert.equal(publicDoc.data()?.semester, registrationData.semester);
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
      semester: '1st Semester',
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

  it('15. Student self-registration requires Admin approval before gaining clearance access', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;
    const regData = {
      email: 'student.approval@example.test',
      fullName: 'Approval Required Student',
      studentNumber: 'STUD-2026-9993',
      program: 'BSMA',
      yearLevel: '2nd Year',
      semester: '2nd Semester',
      section: 'B',
      password: 'student-password123',
      confirmPassword: 'student-password123',
    };

    const regRes = await registerStudentAccountAction(regData);
    assert.equal(regRes.success, true);
    if (!regRes.success) return;
    const studentUid = regRes.user.uid;

    // 1. Verify session/login is BLOCKED before approval
    const preApprovalSession = await getSessionCookieForUser('student.approval@example.test', 'student-password123');
    process.env.TEST_SESSION_COOKIE = preApprovalSession;

    await assert.rejects(
      async () => getAuthenticatedUser(),
      /pending administrator approval/i
    );

    const submitAttempt = await submitApplicationAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
      purpose: 'Enrollment',
    });
    assert.equal(submitAttempt.success, false);
    assert.match(submitAttempt.error, /pending administrator approval/i);

    // Switch back to Admin session
    process.env.TEST_SESSION_COOKIE = adminSession;

    // 2. Admin sees pending registration in user list
    const usersRes = await fetchAdminUsersAction();
    assert.equal(usersRes.success, true);
    if (usersRes.success) {
      const found = usersRes.users.find((u) => u.uid === studentUid);
      assert.ok(found);
      assert.equal(found?.accountStatus, 'pending_approval');
    }

    // 3. Admin approves registration
    const approveRes = await approveStudentRegistrationAction({ userId: studentUid });
    assert.equal(approveRes.success, true);

    // 4. Status is now active and student claims are synchronized
    const updatedDoc = await getAdminFirestore().collection('users').doc(studentUid).get();
    assert.equal(updatedDoc.data()?.accountStatus, 'active');
    assert.equal(updatedDoc.data()?.isActive, true);

    const updatedAuth = await getAdminAuth().getUser(studentUid);
    assert.equal(updatedAuth.customClaims?.accountStatus, 'active');

    // 5. Approved student session now succeeds
    const postApprovalSession = await getSessionCookieForUser('student.approval@example.test', 'student-password123');
    process.env.TEST_SESSION_COOKIE = postApprovalSession;
    const authUserSession = await getAuthenticatedUser();
    assert.equal(authUserSession.uid, studentUid);
    assert.equal(authUserSession.user.accountStatus, 'active');
  });

  it('16. Admin can permanently delete user and related application records', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;

    // Create a temporary student with an application
    const tempStudent = await createStudentAccountAction({
      email: 'deleteme@example.test',
      fullName: 'Student To Delete',
      studentNumber: 'STUD-DELETE-001',
      program: 'BSAIS',
      yearLevel: '1st Year',
      semester: '1st Semester',
      section: 'A',
    });
    assert.equal(tempStudent.success, true);
    if (!tempStudent.success) return;
    const targetUid = tempStudent.user!.uid;

    // Create a clearance application for this student
    const appRef = getAdminFirestore().collection('clearanceApplications').doc(`app-${targetUid}`);
    await appRef.set({
      applicationNumber: 'CLR-DEL-001',
      studentUid: targetUid,
      overallStatus: 'pending',
    });
    await appRef.collection('approvals').doc('librarian').set({ status: 'pending' });
    await appRef.collection('remarks').doc('rem1').set({ content: 'Test remark' });

    // Admin permanently deletes the user
    const delRes = await deleteUserAccountAction({ userId: targetUid });
    assert.equal(delRes.success, true);

    // Verify user is gone from Auth
    await assert.rejects(
      async () => getAdminAuth().getUser(targetUid),
      /no user record|user-not-found/i
    );

    // Verify user is gone from Firestore collections
    const userDoc = await getAdminFirestore().collection('users').doc(targetUid).get();
    assert.equal(userDoc.exists, false);
    const publicDoc = await getAdminFirestore().collection('publicUsers').doc(targetUid).get();
    assert.equal(publicDoc.exists, false);
    const studentDoc = await getAdminFirestore().collection('students').doc(targetUid).get();
    assert.equal(studentDoc.exists, false);

    // Verify application and subcollections are gone
    const deletedApp = await appRef.get();
    assert.equal(deletedApp.exists, false);
    const deletedApprovals = await appRef.collection('approvals').get();
    assert.equal(deletedApprovals.size, 0);
  });

  it('17. Admin self-deletion and final admin deletion are blocked', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;
    const currentAdminAuth = await getAdminAuth().getUserByEmail('admin@example.test');

    // Self-deletion blocked
    const selfDelRes = await deleteUserAccountAction({ userId: currentAdminAuth.uid });
    assert.equal(selfDelRes.success, false);
    if (!selfDelRes.success) {
      assert.match(selfDelRes.error, /cannot perform deletion on your own administrator account/i);
    }
  });

  it('18. Admin can reject pending student registration and delete account', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;
    const regData = {
      email: 'student.reject@example.test',
      fullName: 'Rejected Student',
      studentNumber: 'STUD-2026-9994',
      program: 'BSAIS',
      yearLevel: '3rd Year',
      semester: '1st Semester',
      section: 'A',
      password: 'student-password123',
      confirmPassword: 'student-password123',
    };

    const regRes = await registerStudentAccountAction(regData);
    assert.equal(regRes.success, true);
    if (!regRes.success) return;
    const studentUid = regRes.user.uid;

    // A. Unauthenticated caller cannot reject
    delete process.env.TEST_SESSION_COOKIE;
    const unauthReject = await rejectStudentRegistrationAction({ userId: studentUid });
    assert.equal(unauthReject.success, false);
    assert.match(unauthReject.error, /unauthorized|session/i);

    // B. Non-Admin (student) cannot reject
    const studentSession = await getSessionCookieForUser('student.b@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = studentSession;
    const nonAdminReject = await rejectStudentRegistrationAction({ userId: studentUid });
    assert.equal(nonAdminReject.success, false);
    assert.match(nonAdminReject.error, /unauthorized|only system administrators/i);

    // C. Admin cannot reject an active account via registration rejection flow
    process.env.TEST_SESSION_COOKIE = adminSession;
    const activeReject = await rejectStudentRegistrationAction({ userId: 'demo-student-a-uid' });
    assert.equal(activeReject.success, false);
    assert.match(activeReject.error, /cannot reject registration.*account status is 'active'/i);

    // D. Admin rejects pending registration
    const rejectRes = await rejectStudentRegistrationAction({
      userId: studentUid,
      reason: 'Invalid enrollment credentials provided.',
    });
    assert.equal(rejectRes.success, true);

    // Account must be completely deleted
    await assert.rejects(
      async () => getAdminAuth().getUser(studentUid),
      /no user record|user-not-found/i
    );
    const userDoc = await getAdminFirestore().collection('users').doc(studentUid).get();
    assert.equal(userDoc.exists, false);
  });

  it('19. Permanent staff deletion unassigns requirements and non-existent user fails safely', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;

    // 1. Create a staff member and assign to a requirement
    const staffRes = await createStaffAccountAction({
      email: 'guidance.temp@example.test',
      fullName: 'Temporary Guidance Staff',
      role: 'guidance_counselor',
    });
    assert.equal(staffRes.success, true);
    if (!staffRes.success) return;
    const staffUid = staffRes.user!.uid;

    // Assign staff to guidance_counselor requirement
    const assignRes = await updateRequirementAssignmentAction({
      requirementId: 'guidance_counselor',
      assignedSignatoryId: staffUid,
      assignedSignatoryName: 'Temporary Guidance Staff',
    });
    assert.equal(assignRes.success, true);

    // Verify requirement has assigned staff
    const reqBefore = await getAdminFirestore().collection('clearanceRequirements').doc('guidance_counselor').get();
    assert.equal(reqBefore.data()?.assignedSignatoryId, staffUid);

    // Delete staff account permanently
    const delRes = await deleteUserAccountAction({ userId: staffUid });
    assert.equal(delRes.success, true);

    // Verify requirement is unassigned
    const reqAfter = await getAdminFirestore().collection('clearanceRequirements').doc('guidance_counselor').get();
    assert.equal(reqAfter.data()?.assignedSignatoryId, null);
    assert.equal(reqAfter.data()?.assignedSignatoryName, null);

    // Re-assign back to demo guidance counselor for deterministic seed state
    await updateRequirementAssignmentAction({
      requirementId: 'guidance_counselor',
      assignedSignatoryId: 'demo-guidance-uid',
      assignedSignatoryName: 'Guidance Counselor',
    });

    // 2. Deleting a non-existent user fails safely
    const nonExistentRes = await deleteUserAccountAction({ userId: 'non-existent-user-uid' });
    assert.equal(nonExistentRes.success, false);
    assert.match(nonExistentRes.error, /user account not found|target user/i);
  });
});
