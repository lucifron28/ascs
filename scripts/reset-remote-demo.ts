import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { verifySeedInvariants } from './verify-seed-invariants';
import {
  DEMO_REQUIREMENTS_FIXTURE,
  DEMO_STAFF_FIXTURES,
  DEMO_STUDENT_FIXTURES,
  DEMO_APPLICATION_FIXTURES,
  DEMO_EMULATOR_PASSWORD,
} from '../tests/fixtures/demo-data';
import { DEFAULT_ACADEMIC_PROGRAM_CODE } from '../lib/academic-programs';

const CONFIRMED_REMOTE_DEMO_PROJECT_ID = 'ascs11';
const KNOWN_PRODUCTION_PROJECT_IDS = [
  'ascs-prod',
  'ascs-production',
  'pkm-ascs-prod',
  'lucifron28-ascs',
];

const DEMO_TIMESTAMP = '2026-01-15T09:00:00.000Z';

export interface ResetOptions {
  apply: boolean;
}

export interface DryRunReport {
  projectId: string;
  dryRun: boolean;
  authUsersToDelete: Array<{ uid: string; email: string; displayName?: string }>;
  unexpectedAuthUsers: Array<{ uid: string; email: string; displayName?: string; reason: string }>;
  usersDocsToDelete: Array<{ id: string; role?: string; email?: string; fullName?: string }>;
  publicUsersDocsToDelete: Array<{ id: string; role?: string; fullName?: string }>;
  studentsDocsToDelete: Array<{ id: string; studentNumber?: string; fullName?: string }>;
  requirementsToDelete: Array<{ id: string; role?: string; label?: string }>;
  applicationsToDelete: Array<{ id: string; applicationNumber?: string; studentName?: string }>;
  approvalsToDeleteCount: number;
  remarksToDeleteCount: number;
  notificationsToDeleteCount: number;
  activityLogsToDeleteCount: number;
  adviserRecordsFound: {
    authAccounts: Array<{ uid: string; email: string }>;
    usersDocs: Array<{ id: string; role?: string; email?: string }>;
    publicUsersDocs: Array<{ id: string; role?: string }>;
    requirements: Array<{ id: string; role?: string }>;
    approvals: Array<{ applicationId: string; approvalId: string; signatoryRole?: string }>;
    notifications: Array<{ id: string; message?: string }>;
    activityLogs: Array<{ id: string; action?: string }>;
  };
  deanRecordsToNormalize: Array<{ id: string; fullName?: string; title?: string }>;
}

export function parseResetOptions(argv: string[]): ResetOptions {
  return {
    apply: argv.includes('--apply'),
  };
}

export function assertRemoteResetSafety(projectId: string): void {
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;

  if (useEmulator === 'true' || authHost || firestoreHost) {
    throw new Error(
      'REFUSING EXECUTION: Remote demo reset cannot run against Firebase emulators. Clear emulator environment variables.'
    );
  }

  if (process.env.ASCS_ALLOW_REMOTE_DEMO_RESET !== 'true') {
    throw new Error(
      'REFUSING EXECUTION: ASCS_ALLOW_REMOTE_DEMO_RESET=true is strictly required for destructive remote reset.'
    );
  }

  if (projectId !== CONFIRMED_REMOTE_DEMO_PROJECT_ID) {
    throw new Error(
      `REFUSING EXECUTION: Remote demo reset is restricted to project "${CONFIRMED_REMOTE_DEMO_PROJECT_ID}". Got: "${projectId}".`
    );
  }

  if (KNOWN_PRODUCTION_PROJECT_IDS.includes(projectId.toLowerCase())) {
    throw new Error(
      `REFUSING EXECUTION: Project ID "${projectId}" is recognized as a production project.`
    );
  }
}

function initAdminApp(projectId: string) {
  if (getApps().length > 0) return getApps()[0];

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;

  const isDummyKey = !privateKey || privateKey.includes('...') || privateKey.includes('YOUR_PRIVATE_KEY');
  if (clientEmail && privateKey && !isDummyKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  // Fallback to Application Default Credentials (e.g. from Google Cloud / Firebase CLI)
  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export async function resetRemoteDemo(options: ResetOptions): Promise<DryRunReport> {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    CONFIRMED_REMOTE_DEMO_PROJECT_ID;

  assertRemoteResetSafety(projectId);

  const app = initAdminApp(projectId);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const report: DryRunReport = {
    projectId,
    dryRun: !options.apply,
    authUsersToDelete: [],
    unexpectedAuthUsers: [],
    usersDocsToDelete: [],
    publicUsersDocsToDelete: [],
    studentsDocsToDelete: [],
    requirementsToDelete: [],
    applicationsToDelete: [],
    approvalsToDeleteCount: 0,
    remarksToDeleteCount: 0,
    notificationsToDeleteCount: 0,
    activityLogsToDeleteCount: 0,
    adviserRecordsFound: {
      authAccounts: [],
      usersDocs: [],
      publicUsersDocs: [],
      requirements: [],
      approvals: [],
      notifications: [],
      activityLogs: [],
    },
    deanRecordsToNormalize: [],
  };

  // 1. Inspect all Auth accounts
  let nextPageToken: string | undefined;
  do {
    const list = await auth.listUsers(100, nextPageToken);
    for (const u of list.users) {
      const email = (u.email || '').toLowerCase();
      const isDemoPattern = email.endsWith('@example.test');

      if (!isDemoPattern) {
        report.unexpectedAuthUsers.push({
          uid: u.uid,
          email: u.email || '(no email)',
          displayName: u.displayName || '(no display name)',
          reason: `Email domain does not match expected demo pattern "@example.test"`,
        });
      }

      report.authUsersToDelete.push({
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName,
      });

      if (email.includes('adviser') || (u.displayName || '').toLowerCase().includes('adviser')) {
        report.adviserRecordsFound.authAccounts.push({
          uid: u.uid,
          email: u.email || '',
        });
      }
    }
    nextPageToken = list.pageToken;
  } while (nextPageToken);

  // 2. Inspect users collection
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    report.usersDocsToDelete.push({
      id: doc.id,
      role: data.role,
      email: data.email,
      fullName: data.fullName,
    });

    if (
      data.role === 'adviser' ||
      (data.email && String(data.email).includes('adviser')) ||
      (data.fullName && String(data.fullName).includes('Adviser'))
    ) {
      report.adviserRecordsFound.usersDocs.push({
        id: doc.id,
        role: data.role,
        email: data.email,
      });
    }

    if (data.role === 'dean') {
      if (data.fullName === 'Academic Dean' || (data.title && String(data.title).includes('Academic Dean'))) {
        report.deanRecordsToNormalize.push({
          id: doc.id,
          fullName: data.fullName,
          title: data.title,
        });
      }
    }
  }

  // 3. Inspect publicUsers collection
  const publicUsersSnap = await db.collection('publicUsers').get();
  for (const doc of publicUsersSnap.docs) {
    const data = doc.data();
    report.publicUsersDocsToDelete.push({
      id: doc.id,
      role: data.role,
      fullName: data.fullName,
    });
    if (data.role === 'adviser' || (data.fullName && String(data.fullName).includes('Adviser'))) {
      report.adviserRecordsFound.publicUsersDocs.push({
        id: doc.id,
        role: data.role,
      });
    }
  }

  // 4. Inspect students collection
  const studentsSnap = await db.collection('students').get();
  for (const doc of studentsSnap.docs) {
    const data = doc.data();
    report.studentsDocsToDelete.push({
      id: doc.id,
      studentNumber: data.studentNumber,
      fullName: data.fullName,
    });
  }

  // 5. Inspect clearanceRequirements collection
  const reqsSnap = await db.collection('clearanceRequirements').get();
  for (const doc of reqsSnap.docs) {
    const data = doc.data();
    report.requirementsToDelete.push({
      id: doc.id,
      role: data.role,
      label: data.label,
    });
    if (doc.id === 'adviser' || data.role === 'adviser' || (data.label && String(data.label).includes('Adviser'))) {
      report.adviserRecordsFound.requirements.push({
        id: doc.id,
        role: data.role,
      });
    }
  }

  // 6. Inspect clearanceApplications collection and subcollections
  const appsSnap = await db.collection('clearanceApplications').get();
  for (const doc of appsSnap.docs) {
    const data = doc.data();
    report.applicationsToDelete.push({
      id: doc.id,
      applicationNumber: data.applicationNumber,
      studentName: data.studentName,
    });

    const approvalsSnap = await doc.ref.collection('approvals').get();
    report.approvalsToDeleteCount += approvalsSnap.size;
    for (const appDoc of approvalsSnap.docs) {
      const appData = appDoc.data();
      if (appDoc.id === 'adviser' || appData.signatoryRole === 'adviser') {
        report.adviserRecordsFound.approvals.push({
          applicationId: doc.id,
          approvalId: appDoc.id,
          signatoryRole: appData.signatoryRole,
        });
      }
    }

    const remarksSnap = await doc.ref.collection('remarks').get();
    report.remarksToDeleteCount += remarksSnap.size;
  }

  // 7. Inspect notifications collection
  const notifsSnap = await db.collection('notifications').get();
  report.notificationsToDeleteCount = notifsSnap.size;
  for (const doc of notifsSnap.docs) {
    const data = doc.data();
    if (
      data.role === 'adviser' ||
      data.actorRole === 'adviser' ||
      data.recipientRole === 'adviser' ||
      (data.message && String(data.message).includes('Adviser'))
    ) {
      report.adviserRecordsFound.notifications.push({
        id: doc.id,
        message: data.message,
      });
    }
  }

  // 8. Inspect activityLogs collection
  const logsSnap = await db.collection('activityLogs').get();
  report.activityLogsToDeleteCount = logsSnap.size;
  for (const doc of logsSnap.docs) {
    const data = doc.data();
    if (
      data.actorRole === 'adviser' ||
      (data.action && String(data.action).includes('adviser'))
    ) {
      report.adviserRecordsFound.activityLogs.push({
        id: doc.id,
        action: data.action,
      });
    }
  }

  // Safety Gate: If unexpected non-demo users found, report and fail before any mutation
  if (report.unexpectedAuthUsers.length > 0) {
    console.error('🚨 HARD SAFETY GUARD TRIGGERED: Unexpected non-demo user accounts detected on remote project!');
    for (const record of report.unexpectedAuthUsers) {
      console.error(`  - UID: ${record.uid} | Email: ${record.email} | Name: ${record.displayName} | Reason: ${record.reason}`);
    }
    throw new Error(
      `HARD SAFETY STOP: Found ${report.unexpectedAuthUsers.length} unexpected non-demo user account(s). Remote destructive operation aborted.`
    );
  }

  if (!options.apply) {
    return report;
  }

  // APPLY DESTRUCTIVE RESET
  console.log(`🧹 Applying destructive reset to remote project "${projectId}"...`);

  // Delete Auth users
  for (const u of report.authUsersToDelete) {
    await auth.deleteUser(u.uid).catch((err) => {
      console.warn(`Warning: failed to delete Auth user ${u.uid} (${u.email}):`, err.message);
    });
  }

  // Clear applications and subcollections in batches
  for (const appDoc of appsSnap.docs) {
    const approvals = await appDoc.ref.collection('approvals').get();
    for (const a of approvals.docs) await a.ref.delete();
    const remarks = await appDoc.ref.collection('remarks').get();
    for (const r of remarks.docs) await r.ref.delete();
    await appDoc.ref.delete();
  }

  // Clear Firestore collections
  const collectionsToClear = [
    'users',
    'publicUsers',
    'students',
    'clearanceRequirements',
    'notifications',
    'activityLogs',
  ];

  for (const colName of collectionsToClear) {
    const snap = await db.collection(colName).get();
    let batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count === 450) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  }

  console.log('🌱 Reseeding canonical current demo data...');

  // 1. Reseed Requirements
  for (const req of DEMO_REQUIREMENTS_FIXTURE) {
    let assignedSignatoryId: string | null = null;
    let assignedSignatoryName: string | null = null;
    const staffMatch = DEMO_STAFF_FIXTURES.find((s) => s.role === req.role);
    if (staffMatch) {
      assignedSignatoryId = staffMatch.uid;
      assignedSignatoryName = staffMatch.fullName;
    }

    await db.collection('clearanceRequirements').doc(req.id).set({
      ...req,
      assignedSignatoryId,
      assignedSignatoryName,
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    });
  }

  // 2. Reseed Staff and Student Auth + Firestore Users
  const allUsers = [...DEMO_STAFF_FIXTURES, ...DEMO_STUDENT_FIXTURES];
  for (const user of allUsers) {
    let authUid = user.uid;
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        password: user.password || DEMO_EMULATOR_PASSWORD,
        displayName: user.fullName,
        disabled: user.accountStatus === 'inactive',
      });
    } catch {
      try {
        const existing = await auth.getUserByEmail(user.email);
        authUid = existing.uid;
      } catch {
        authUid = user.uid;
      }
    }

    await auth.updateUser(authUid, {
      email: user.email,
      password: user.password || DEMO_EMULATOR_PASSWORD,
      displayName: user.fullName,
      emailVerified: true,
      disabled: user.accountStatus === 'inactive',
    });
    await auth.setCustomUserClaims(authUid, {
      role: user.role,
      ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
    });

    const now = new Date(DEMO_TIMESTAMP);
    await db.collection('users').doc(authUid).set({
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

    await db.collection('publicUsers').doc(authUid).set({
      fullName: user.fullName,
      role: user.role,
    });

    if (user.role === 'student') {
      await db.collection('students').doc(authUid).set({
        uid: authUid,
        studentNumber: user.studentNumber || 'STUD-2026-0000',
        fullName: user.fullName,
        program: user.program || DEFAULT_ACADEMIC_PROGRAM_CODE,
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

  // 3. Reseed Canonical Applications and Approvals
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
      deanApproved: appFixture.deanApproved,
      printableAvailable: appFixture.printableAvailable,
      pendingCount: appFixture.pendingCount,
      approvedCount: appFixture.approvedCount,
      notApprovedCount: appFixture.notApprovedCount,
      submittedAt: nowIso,
      updatedAt: nowIso,
    });

    // Subcollection: approvals (exactly 5 active roles)
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

    // Seed student notification
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

  console.log('✅ Remote reset complete. Verifying invariants...');
  await verifySeedInvariants();

  return report;
}

if (require.main === module) {
  const options = parseResetOptions(process.argv.slice(2));
  resetRemoteDemo(options)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Reset remote demo failed:', err.message);
      process.exit(1);
    });
}
