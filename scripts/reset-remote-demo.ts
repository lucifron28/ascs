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

export const CONFIRMED_REMOTE_DEMO_PROJECT_ID = 'ascs11';
export const KNOWN_PRODUCTION_PROJECT_IDS = [
  'ascs-prod',
  'ascs-production',
  'pkm-ascs-prod',
  'lucifron28-ascs',
];

const DEMO_TIMESTAMP = '2026-01-15T09:00:00.000Z';

export const KNOWN_CANONICAL_REQUIREMENT_IDS = [
  'librarian',
  'osa_coordinator',
  'guidance_counselor',
  'area_chair',
  'dean',
] as const;

export interface ResetOptions {
  apply: boolean;
}

export interface UnexpectedAuthUser {
  uid: string;
  email: string;
  displayName?: string;
  reason: string;
}

export interface UnexpectedFirestoreRecord {
  collection: 'users' | 'publicUsers' | 'students' | 'clearanceRequirements';
  id: string;
  reason: string;
  data?: Record<string, unknown>;
}

export interface AdviserRecordsFoundSummary {
  authAccounts: Array<{ uid: string; email: string }>;
  usersDocs: Array<{ id: string; role?: string; email?: string }>;
  publicUsersDocs: Array<{ id: string; role?: string }>;
  requirements: Array<{ id: string; role?: string }>;
  approvals: Array<{ applicationId: string; approvalId: string; signatoryRole?: string }>;
  notifications: Array<{ id: string; message?: string }>;
  activityLogs: Array<{ id: string; action?: string }>;
}

export interface DryRunReport {
  projectId: string;
  dryRun: boolean;
  authUsersToDelete: Array<{ uid: string; email: string; displayName?: string }>;
  unexpectedAuthUsers: UnexpectedAuthUser[];
  usersDocsToDelete: Array<{ id: string; role?: string; email?: string; fullName?: string }>;
  publicUsersDocsToDelete: Array<{ id: string; role?: string; fullName?: string }>;
  studentDocsToDelete: Array<{ id: string; studentNumber?: string; fullName?: string }>;
  studentsDocsToDelete: Array<{ id: string; studentNumber?: string; fullName?: string }>;
  requirementsToDelete: Array<{ id: string; role?: string; label?: string }>;
  applicationsToDelete: Array<{ id: string; applicationNumber?: string; studentName?: string }>;
  approvalCount: number;
  approvalsToDeleteCount: number;
  remarkCount: number;
  remarksToDeleteCount: number;
  notificationCount: number;
  notificationsToDeleteCount: number;
  activityLogCount: number;
  activityLogsToDeleteCount: number;
  adviserRecordsFound: AdviserRecordsFoundSummary;
  unexpectedFirestoreRecords: UnexpectedFirestoreRecord[];
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
  const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const databaseHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  const hubHost = process.env.FIREBASE_EMULATOR_HUB;
  const functionsHost = process.env.FUNCTIONS_EMULATOR;

  if (
    useEmulator === 'true' ||
    useEmulator === '1' ||
    authHost ||
    firestoreHost ||
    storageHost ||
    databaseHost ||
    hubHost ||
    functionsHost
  ) {
    throw new Error(
      'REFUSING EXECUTION: Remote demo reset cannot run against Firebase emulators. Clear emulator environment variables.'
    );
  }

  if (process.env.ASCS_ALLOW_REMOTE_DEMO_RESET !== 'true') {
    throw new Error(
      'REFUSING EXECUTION: ASCS_ALLOW_REMOTE_DEMO_RESET=true is strictly required for destructive remote reset.'
    );
  }

  const normalizedProjectId = (projectId || '').trim();
  if (normalizedProjectId !== CONFIRMED_REMOTE_DEMO_PROJECT_ID) {
    throw new Error(
      `REFUSING EXECUTION: Remote demo reset is restricted to project "${CONFIRMED_REMOTE_DEMO_PROJECT_ID}". Got: "${normalizedProjectId}".`
    );
  }

  if (KNOWN_PRODUCTION_PROJECT_IDS.includes(normalizedProjectId.toLowerCase())) {
    throw new Error(
      `REFUSING EXECUTION: Project ID "${normalizedProjectId}" is recognized as a production project.`
    );
  }
}

export function isDemoEmail(email?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return email.toLowerCase().trim().endsWith('@example.test');
}

export function isDemoUid(uid?: string): boolean {
  if (!uid || typeof uid !== 'string') return false;
  return uid.startsWith('demo-');
}

export function classifyAuthUser(user: {
  uid: string;
  email?: string;
  displayName?: string;
}): { isDemo: boolean; isAdviser: boolean; reason?: string } {
  const email = (user.email || '').toLowerCase().trim();
  const uid = user.uid || '';
  const displayName = (user.displayName || '').toLowerCase();

  const isAdviser =
    uid === 'demo-adviser-uid' ||
    email === 'adviser@example.test' ||
    email.includes('adviser') ||
    displayName.includes('adviser');

  if (!email || !isDemoEmail(email)) {
    return {
      isDemo: false,
      isAdviser,
      reason: email
        ? `Email domain does not match expected demo pattern "@example.test": ${email}`
        : 'Auth account is missing an email address',
    };
  }

  return { isDemo: true, isAdviser };
}

export function classifyFirestoreUser(
  id: string,
  data: Record<string, unknown> = {}
): { isDemo: boolean; isAdviser: boolean; reason?: string } {
  const email = typeof data.email === 'string' ? data.email.toLowerCase().trim() : '';
  const role = typeof data.role === 'string' ? data.role.toLowerCase().trim() : '';
  const fullName = typeof data.fullName === 'string' ? data.fullName.toLowerCase() : '';

  const isAdviser =
    id === 'demo-adviser-uid' ||
    email === 'adviser@example.test' ||
    role === 'adviser' ||
    fullName.includes('adviser');

  if (isAdviser) {
    if (email && !isDemoEmail(email)) {
      return {
        isDemo: false,
        isAdviser: true,
        reason: `Adviser record with non-demo email domain: ${email}`,
      };
    }
    return { isDemo: true, isAdviser: true };
  }

  if (email && !isDemoEmail(email)) {
    return {
      isDemo: false,
      isAdviser: false,
      reason: `User document email domain does not match "@example.test": ${email}`,
    };
  }

  if (!isDemoUid(id) && !isDemoEmail(email)) {
    return {
      isDemo: false,
      isAdviser: false,
      reason: `User doc ID "${id}" does not start with "demo-" and has no demo email`,
    };
  }

  return { isDemo: true, isAdviser: false };
}

export function classifyFirestorePublicUser(
  id: string,
  data: Record<string, unknown> = {}
): { isDemo: boolean; isAdviser: boolean; reason?: string } {
  const role = typeof data.role === 'string' ? data.role.toLowerCase().trim() : '';
  const fullName = typeof data.fullName === 'string' ? data.fullName.toLowerCase() : '';

  const isAdviser = id === 'demo-adviser-uid' || role === 'adviser' || fullName.includes('adviser');
  if (isAdviser) {
    return { isDemo: true, isAdviser: true };
  }

  if (!isDemoUid(id)) {
    return {
      isDemo: false,
      isAdviser: false,
      reason: `PublicUser doc ID "${id}" does not start with "demo-"`,
    };
  }

  return { isDemo: true, isAdviser: false };
}

export function classifyFirestoreStudent(
  id: string,
  data: Record<string, unknown> = {}
): { isDemo: boolean; isAdviser: boolean; reason?: string } {
  const email = typeof data.email === 'string' ? data.email.toLowerCase().trim() : '';
  const studentNumber = typeof data.studentNumber === 'string' ? data.studentNumber.trim() : '';

  if (id === 'demo-adviser-uid') {
    return { isDemo: true, isAdviser: true };
  }

  if (email && !isDemoEmail(email)) {
    return {
      isDemo: false,
      isAdviser: false,
      reason: `Student email domain does not match "@example.test": ${email}`,
    };
  }

  const isDemoStudentNumber =
    !studentNumber || studentNumber.startsWith('STUD-') || studentNumber.startsWith('demo-');

  if (!isDemoUid(id) && !isDemoStudentNumber) {
    return {
      isDemo: false,
      isAdviser: false,
      reason: `Student doc ID "${id}" and studentNumber "${studentNumber}" do not match demo patterns`,
    };
  }

  return { isDemo: true, isAdviser: false };
}

export function classifyFirestoreRequirement(
  id: string,
  data: Record<string, unknown> = {}
): { isDemo: boolean; isAdviser: boolean; reason?: string } {
  const role = typeof data.role === 'string' ? data.role.toLowerCase().trim() : '';
  const label = typeof data.label === 'string' ? data.label.toLowerCase() : '';

  const isAdviser = id === 'adviser' || role === 'adviser' || label.includes('adviser');
  if (isAdviser) {
    return { isDemo: true, isAdviser: true };
  }

  if (!KNOWN_CANONICAL_REQUIREMENT_IDS.includes(id as (typeof KNOWN_CANONICAL_REQUIREMENT_IDS)[number])) {
    return {
      isDemo: false,
      isAdviser: false,
      reason: `Unknown requirement ID "${id}". Expected one of: ${KNOWN_CANONICAL_REQUIREMENT_IDS.join(', ')}, adviser`,
    };
  }

  return { isDemo: true, isAdviser: false };
}

export function assertRecordsSafety(
  unexpectedAuthUsers: UnexpectedAuthUser[],
  unexpectedFirestoreRecords: UnexpectedFirestoreRecord[]
): void {
  const total = unexpectedAuthUsers.length + unexpectedFirestoreRecords.length;
  if (total > 0) {
    if (unexpectedAuthUsers.length > 0) {
      console.error('🚨 HARD SAFETY GUARD: Unexpected non-demo user accounts detected on remote project:');
      for (const record of unexpectedAuthUsers) {
        console.error(`  - UID: ${record.uid} | Email: ${record.email} | Reason: ${record.reason}`);
      }
    }
    if (unexpectedFirestoreRecords.length > 0) {
      console.error('🚨 HARD SAFETY GUARD: Unexpected non-demo Firestore records detected on remote project:');
      for (const record of unexpectedFirestoreRecords) {
        console.error(`  - Collection: ${record.collection} | ID: ${record.id} | Reason: ${record.reason}`);
      }
    }
    throw new Error(
      `HARD SAFETY STOP: Found ${total} unexpected non-demo record(s) (${unexpectedAuthUsers.length} Auth account(s), ${unexpectedFirestoreRecords.length} Firestore record(s)). Remote destructive operation aborted.`
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
    studentDocsToDelete: [],
    studentsDocsToDelete: [],
    requirementsToDelete: [],
    applicationsToDelete: [],
    approvalCount: 0,
    approvalsToDeleteCount: 0,
    remarkCount: 0,
    remarksToDeleteCount: 0,
    notificationCount: 0,
    notificationsToDeleteCount: 0,
    activityLogCount: 0,
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
    unexpectedFirestoreRecords: [],
    deanRecordsToNormalize: [],
  };

  // 1. Inspect all Auth accounts
  let nextPageToken: string | undefined;
  do {
    const list = await auth.listUsers(100, nextPageToken);
    for (const u of list.users) {
      const classification = classifyAuthUser({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
      });

      if (!classification.isDemo) {
        report.unexpectedAuthUsers.push({
          uid: u.uid,
          email: u.email || '(no email)',
          displayName: u.displayName || '(no display name)',
          reason: classification.reason || 'Non-demo account',
        });
      }

      report.authUsersToDelete.push({
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName,
      });

      if (classification.isAdviser) {
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
    const classification = classifyFirestoreUser(doc.id, data);

    if (!classification.isDemo) {
      report.unexpectedFirestoreRecords.push({
        collection: 'users',
        id: doc.id,
        reason: classification.reason || 'Non-demo user profile',
        data,
      });
    }

    report.usersDocsToDelete.push({
      id: doc.id,
      role: data.role,
      email: data.email,
      fullName: data.fullName,
    });

    if (classification.isAdviser) {
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
    const classification = classifyFirestorePublicUser(doc.id, data);

    if (!classification.isDemo) {
      report.unexpectedFirestoreRecords.push({
        collection: 'publicUsers',
        id: doc.id,
        reason: classification.reason || 'Non-demo public user profile',
        data,
      });
    }

    report.publicUsersDocsToDelete.push({
      id: doc.id,
      role: data.role,
      fullName: data.fullName,
    });

    if (classification.isAdviser) {
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
    const classification = classifyFirestoreStudent(doc.id, data);

    if (!classification.isDemo) {
      report.unexpectedFirestoreRecords.push({
        collection: 'students',
        id: doc.id,
        reason: classification.reason || 'Non-demo student record',
        data,
      });
    }

    const studentInfo = {
      id: doc.id,
      studentNumber: data.studentNumber,
      fullName: data.fullName,
    };
    report.studentDocsToDelete.push(studentInfo);
    report.studentsDocsToDelete.push(studentInfo);
  }

  // 5. Inspect clearanceRequirements collection
  const reqsSnap = await db.collection('clearanceRequirements').get();
  for (const doc of reqsSnap.docs) {
    const data = doc.data();
    const classification = classifyFirestoreRequirement(doc.id, data);

    if (!classification.isDemo) {
      report.unexpectedFirestoreRecords.push({
        collection: 'clearanceRequirements',
        id: doc.id,
        reason: classification.reason || 'Unexpected clearance requirement',
        data,
      });
    }

    report.requirementsToDelete.push({
      id: doc.id,
      role: data.role,
      label: data.label,
    });

    if (classification.isAdviser) {
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
    report.approvalCount += approvalsSnap.size;
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
    report.remarkCount += remarksSnap.size;
    report.remarksToDeleteCount += remarksSnap.size;
  }

  // 7. Inspect notifications collection
  const notifsSnap = await db.collection('notifications').get();
  report.notificationCount = notifsSnap.size;
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
  report.activityLogCount = logsSnap.size;
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

  // Hard Safety Assertion: Fail if ANY unexpected non-demo user or Firestore record exists
  assertRecordsSafety(report.unexpectedAuthUsers, report.unexpectedFirestoreRecords);

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
  // Bridge environment variable so verifySeedInvariants passes in remote mode
  process.env.ASCS_ALLOW_REMOTE_DEMO_SEED = 'true';
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
