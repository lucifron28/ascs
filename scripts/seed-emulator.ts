import { getAdminAuth, getAdminFirestore } from '../lib/firebase/admin';
import { assertEmulatorEnvironment } from './emulator-safety';
import { verifySeedInvariants } from './verify-seed-invariants';
import {
  DEMO_REQUIREMENTS_FIXTURE,
  DEMO_STAFF_FIXTURES,
  DEMO_STUDENT_FIXTURES,
  DEMO_APPLICATION_FIXTURES,
} from '../tests/fixtures/demo-data';

// Keep the fictional evidence dataset stable across resets so screenshots and
// defense walkthroughs do not change merely because the clock moved.
const DEMO_TIMESTAMP = '2026-01-15T09:00:00.000Z';

export async function seedEmulator(): Promise<void> {
  const env = assertEmulatorEnvironment();
  console.log(`🌱 Seeding Firebase Emulator Suite for project "${env.projectId}"...`);

  const auth = getAdminAuth();
  const db = getAdminFirestore();

  // 1. Seed Clearance Requirements
  const reqCol = db.collection('clearanceRequirements');
  await reqCol.doc('accountant').delete().catch(() => {});

  for (const req of DEMO_REQUIREMENTS_FIXTURE) {
    let assignedSignatoryId: string | null = null;
    let assignedSignatoryName: string | null = null;
    const staffMatch = DEMO_STAFF_FIXTURES.find((s) => s.role === req.role);
    if (staffMatch) {
      assignedSignatoryId = staffMatch.uid;
      assignedSignatoryName = staffMatch.fullName;
    }

    await reqCol.doc(req.id).set({
      ...req,
      assignedSignatoryId,
      assignedSignatoryName,
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    });
  }

  // 2. Seed All Users (Staff + Students)
  const allUsers = [...DEMO_STAFF_FIXTURES, ...DEMO_STUDENT_FIXTURES];
  const usersCol = db.collection('users');
  const publicCol = db.collection('publicUsers');
  const studentsCol = db.collection('students');

  for (const user of allUsers) {
    // Auth account
    let authUid = user.uid;
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        password: user.password,
        displayName: user.fullName,
        disabled: user.accountStatus === 'inactive',
      });
    } catch (authErr: unknown) {
      const err = authErr as { code?: string; message?: string };
      if (err.code === 'auth/email-already-exists' || err.code === 'auth/uid-already-exists') {
        // update existing
        try {
          const existing = await auth.getUserByEmail(user.email);
          authUid = existing.uid;
        } catch {
          authUid = user.uid;
        }
      }
    }

    await auth.updateUser(authUid, {
      email: user.email,
      password: user.password,
      displayName: user.fullName,
      emailVerified: true,
      disabled: user.accountStatus === 'inactive',
    });
    await auth.setCustomUserClaims(authUid, {
      role: user.role,
      ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
    });

    const now = new Date(DEMO_TIMESTAMP);
    await usersCol.doc(authUid).set({
      uid: authUid,
      email: user.email,
      username: user.email.split('@')[0],
      fullName: user.fullName,
      role: user.role,
      accountStatus: user.accountStatus,
      isActive: user.accountStatus === 'active',
      mustChangePassword: user.mustChangePassword === true,
      contactNumber: '09123456789',
      createdAt: now,
      updatedAt: now,
      deactivatedAt: user.accountStatus === 'inactive' ? now : null,
    });

    await publicCol.doc(authUid).set({
      fullName: user.fullName,
      role: user.role,
    });

    if (user.role === 'student') {
      await studentsCol.doc(authUid).set({
        uid: authUid,
        studentNumber: user.studentNumber || 'STUD-2026-0000',
        fullName: user.fullName,
        program: user.program || 'BSIT',
        yearLevel: user.yearLevel || '4th Year',
        section: user.section || 'A',
        email: user.email,
        contactNumber: '09123456789',
        accountStatus: user.accountStatus,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 3. Seed Applications, Approvals, Remarks, Notifications, Activity Logs
  const appsCol = db.collection('clearanceApplications');
  const notifCol = db.collection('notifications');
  const logsCol = db.collection('activityLogs');

  for (const appFixture of DEMO_APPLICATION_FIXTURES) {
    const appRef = appsCol.doc(appFixture.id);
    const nowIso = DEMO_TIMESTAMP;

    await appRef.set({
      applicationNumber: appFixture.applicationNumber,
      studentId: appFixture.studentUid,
      studentUid: appFixture.studentUid,
      studentNumber: appFixture.studentNumber,
      studentName: appFixture.studentName,
      program: appFixture.program,
      yearLevel: appFixture.yearLevel,
      section: appFixture.section,
      academicYear: appFixture.academicYear,
      semester: appFixture.semester,
      purpose: appFixture.purpose,
      overallStatus: appFixture.overallStatus,
      financialStatus: appFixture.financialStatus,
      financialVerifiedAt: appFixture.financialStatus !== 'pending' ? nowIso : null,
      financialRemarks: appFixture.financialRemarks,
      financialUpdatedBy: appFixture.financialStatus !== 'pending' ? 'demo-accountant-uid' : null,
      financialUpdatedByName: appFixture.financialStatus !== 'pending' ? 'Accountant Officer' : null,
      adviserApproved: appFixture.adviserApproved,
      printableAvailable: appFixture.printableAvailable,
      pendingCount: appFixture.pendingCount,
      approvedCount: appFixture.approvedCount,
      notApprovedCount: appFixture.notApprovedCount,
      submittedAt: nowIso,
      updatedAt: nowIso,
    });

    // Approvals subcollection
    for (const req of DEMO_REQUIREMENTS_FIXTURE) {
      const appVal = appFixture.approvals[req.id] || { status: 'pending', remarksLatest: null };
      const staffMatch = DEMO_STAFF_FIXTURES.find((s) => s.role === req.role);
      const approvalRef = appRef.collection('approvals').doc(req.id);

      await approvalRef.set({
        requirementId: req.id,
        signatoryRole: req.role,
        assignedSignatoryId: staffMatch?.uid || null,
        assignedSignatoryName: staffMatch?.fullName || null,
        status: appVal.status,
        remarksLatest: appVal.remarksLatest,
        actedAt: appVal.status !== 'pending' ? nowIso : null,
        updatedAt: nowIso,
      });

      if (appVal.remarksLatest) {
        await appRef.collection('remarks').doc(`remark-${req.id}`).set({
          approvalId: req.id,
          authorId: staffMatch?.uid || 'demo-system-uid',
          authorName: staffMatch?.fullName || 'System',
          authorRole: req.role,
          content: appVal.remarksLatest,
          createdAt: nowIso,
        });
      }
    }

    // Seed notification for student
    await notifCol.doc(`notif-${appFixture.id}`).set({
      recipientId: appFixture.studentUid,
      type: 'status_update',
      message: `Your clearance application ${appFixture.applicationNumber} is ${appFixture.overallStatus}.`,
      relatedApplicationId: appFixture.id,
      isRead: false,
      createdAt: nowIso,
    });

    // Activity log
    await logsCol.doc(`log-${appFixture.id}`).set({
      actorId: appFixture.studentUid,
      actorName: appFixture.studentName,
      actorRole: 'student',
      action: 'clearance_submitted',
      entityType: 'clearance_application',
      entityId: appFixture.id,
      metadata: { applicationNumber: appFixture.applicationNumber },
      createdAt: nowIso,
    });
  }

  console.log('✅ Seeding completed. Verifying invariants...');
  await verifySeedInvariants();
}

if (require.main === module) {
  seedEmulator()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed emulator failed:', err);
      process.exit(1);
    });
}
