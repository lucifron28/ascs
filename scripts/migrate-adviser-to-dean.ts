import { getAdminAuth, getAdminFirestore } from '../lib/firebase/admin';
import { getClearanceStatusSummary, REQUIRED_SIGNATORY_ROLES } from '../lib/clearance/status';
import type { DocumentData, QueryDocumentSnapshot, WriteBatch } from 'firebase-admin/firestore';

const REMOTE_PROJECT_ID = 'ascs11';
const DEAN_EMAIL = 'dean@example.test';

export interface MigrationOptions {
  apply: boolean;
  verify: boolean;
}

export interface MigrationReport {
  requirementsUpdated: number;
  requirementsDeactivated: number;
  applicationsScanned: number;
  deanApprovalsCreated: number;
  deanApprovalsUpdated: number;
  legacyApprovalsRetained: number;
  applicationsRecomputed: number;
  applicationsMissingDeanApproval: number;
}

function parseOptions(argv: string[]): MigrationOptions {
  return {
    apply: argv.includes('--apply'),
    verify: argv.includes('--verify'),
  };
}

/** Guard every remote read/write behind an explicit environment confirmation. */
export function assertRemoteMigrationEnvironment(): void {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    '';

  if (process.env.ASCS_ALLOW_REMOTE_DEMO_MIGRATION !== 'true') {
    throw new Error(
      'REFUSING EXECUTION: Set ASCS_ALLOW_REMOTE_DEMO_MIGRATION=true before inspecting or migrating deployed demo data.',
    );
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    throw new Error('REFUSING EXECUTION: Adviser-to-Dean migration cannot run against Firebase emulators.');
  }
  if (projectId !== REMOTE_PROJECT_ID) {
    throw new Error(`REFUSING EXECUTION: Migration is restricted to Firebase project "${REMOTE_PROJECT_ID}".`);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  if (
    !clientEmail ||
    !privateKey ||
    clientEmail.includes('xxxxx') ||
    privateKey.includes('...') ||
    privateKey.includes('YOUR_PRIVATE_KEY')
  ) {
    throw new Error('REFUSING EXECUTION: A real Firebase Admin service-account credential is required.');
  }
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function isInactive(data: DocumentData | undefined): boolean {
  return data?.accountStatus === 'inactive' || data?.isActive === false;
}

async function flushBatch(batch: WriteBatch | null, pendingWrites: number): Promise<void> {
  if (batch && pendingWrites > 0) await batch.commit();
}

/** Verify the post-migration invariants without changing data. */
export async function verifyMigrationState(): Promise<void> {
  const firestore = getAdminFirestore();
  const requirementsSnap = await firestore.collection('clearanceRequirements').get();
  const activeRequirements = requirementsSnap.docs.filter((doc) => doc.data().isActive !== false);
  const activeRoles = activeRequirements.map((doc) => String(doc.data().role));
  const uniqueActiveRoles = new Set(activeRoles);

  if (uniqueActiveRoles.size !== REQUIRED_SIGNATORY_ROLES.length || !REQUIRED_SIGNATORY_ROLES.every((role) => uniqueActiveRoles.has(role))) {
    throw new Error(`Verification failed: expected exactly five active roles (${REQUIRED_SIGNATORY_ROLES.join(', ')}), got ${activeRoles.join(', ')}.`);
  }
  if (activeRoles.includes('adviser')) {
    throw new Error('Verification failed: Adviser requirement is still active.');
  }

  const deanRequirement = requirementsSnap.docs.find((doc) => doc.data().role === 'dean');
  if (!deanRequirement || deanRequirement.data().label !== 'Dean Clearance') {
    throw new Error('Verification failed: Dean Clearance requirement is missing or mislabeled.');
  }

  const applicationsSnap = await firestore.collection('clearanceApplications').get();
  let missingDeanApproval = 0;
  for (const app of applicationsSnap.docs) {
    if (typeof app.data().deanApproved !== 'boolean') missingDeanApproval++;
  }
  if (missingDeanApproval > 0) {
    throw new Error(`Verification failed: ${missingDeanApproval} application(s) are missing deanApproved.`);
  }
}

export async function migrateAdviserToDean(options: MigrationOptions): Promise<MigrationReport> {
  assertRemoteMigrationEnvironment();

  const firestore = getAdminFirestore();
  const auth = getAdminAuth();
  const deanAuth = await auth.getUserByEmail(DEAN_EMAIL);
  const deanRef = firestore.collection('users').doc(deanAuth.uid);
  const deanSnap = await deanRef.get();
  const deanData = deanSnap.data();
  if (!deanSnap.exists || deanData?.role !== 'dean' || isInactive(deanData)) {
    throw new Error(`Migration requires an active Dean profile for ${DEAN_EMAIL}.`);
  }
  if (deanAuth.customClaims?.role !== 'dean') {
    throw new Error(`Migration requires Firebase Auth role=dean for ${DEAN_EMAIL}.`);
  }

  const deanName = stringValue(deanData.fullName, deanAuth.displayName || 'Academic Dean');
  const now = new Date().toISOString();
  let batch: WriteBatch | null = options.apply ? firestore.batch() : null;
  let pendingWrites = 0;
  const queueWrite = async (writer: (current: WriteBatch) => void) => {
    if (!batch) return;
    writer(batch);
    pendingWrites++;
    if (pendingWrites >= 300) {
      await flushBatch(batch, pendingWrites);
      batch = firestore.batch();
      pendingWrites = 0;
    }
  };

  const report: MigrationReport = {
    requirementsUpdated: 0,
    requirementsDeactivated: 0,
    applicationsScanned: 0,
    deanApprovalsCreated: 0,
    deanApprovalsUpdated: 0,
    legacyApprovalsRetained: 0,
    applicationsRecomputed: 0,
    applicationsMissingDeanApproval: 0,
  };

  const requirementsSnap = await firestore.collection('clearanceRequirements').get();
  const deanRequirement = requirementsSnap.docs.find((doc) => doc.data().role === 'dean');
  const adviserRequirement = requirementsSnap.docs.find((doc) => doc.data().role === 'adviser');
  const deanRequirementRef = deanRequirement?.ref || firestore.collection('clearanceRequirements').doc('dean');
  const deanRequirementData = deanRequirement?.data() || {};

  await queueWrite((current) => current.set(deanRequirementRef, {
    role: 'dean',
    label: 'Dean Clearance',
    displayOrder: 5,
    isActive: true,
    assignedSignatoryId: deanAuth.uid,
    assignedSignatoryName: deanName,
    createdAt: deanRequirementData.createdAt || now,
    updatedAt: now,
  }, { merge: true }));
  report.requirementsUpdated++;

  if (adviserRequirement) {
    await queueWrite((current) => current.update(adviserRequirement.ref, {
      isActive: false,
      legacyOnly: true,
      migrationTargetRole: 'dean',
      updatedAt: now,
    }));
    report.requirementsDeactivated++;
  }

  const applicationsSnap = await firestore.collection('clearanceApplications').get();
  report.applicationsScanned = applicationsSnap.size;

  for (const appDoc of applicationsSnap.docs) {
    const approvalsSnap = await appDoc.ref.collection('approvals').get();
    const legacyDoc = approvalsSnap.docs.find((doc) => doc.id === 'adviser' || doc.data().signatoryRole === 'adviser');
    const existingDeanDoc = approvalsSnap.docs.find((doc) => doc.id === 'dean' || doc.data().signatoryRole === 'dean');
    const sourceData = existingDeanDoc?.data() || legacyDoc?.data() || {};
    const deanApprovalRef = existingDeanDoc?.ref || appDoc.ref.collection('approvals').doc('dean');
    const deanApprovalData = {
      ...sourceData,
      requirementId: 'dean',
      signatoryRole: 'dean',
      assignedSignatoryId: deanAuth.uid,
      assignedSignatoryName: deanName,
      status: stringValue(sourceData.status, 'pending'),
      remarksLatest: sourceData.remarksLatest ?? null,
      actedAt: sourceData.actedAt ?? null,
      updatedAt: now,
      ...(legacyDoc && !existingDeanDoc ? { legacySourceApprovalId: legacyDoc.id } : {}),
    };

    if (existingDeanDoc) report.deanApprovalsUpdated++;
    else report.deanApprovalsCreated++;
    await queueWrite((current) => current.set(deanApprovalRef, deanApprovalData, { merge: true }));

    if (legacyDoc) {
      report.legacyApprovalsRetained++;
      await queueWrite((current) => current.set(legacyDoc.ref, {
        legacyRetained: true,
        legacyMigratedTo: 'dean',
        updatedAt: now,
      }, { merge: true }));
    }

    const approvalStatuses = approvalsSnap.docs
      .filter((doc) => doc.ref.path !== legacyDoc?.ref.path)
      .map((doc: QueryDocumentSnapshot) => ({
        status: doc.id === 'dean' || doc.data().signatoryRole === 'dean' ? deanApprovalData.status : doc.data().status,
        signatoryRole: doc.id === 'dean' || doc.data().signatoryRole === 'dean' ? 'dean' : doc.data().signatoryRole,
      }));
    if (!existingDeanDoc && !approvalStatuses.some((approval) => approval.signatoryRole === 'dean')) {
      approvalStatuses.push({ status: deanApprovalData.status, signatoryRole: 'dean' });
    }
    const summary = getClearanceStatusSummary(approvalStatuses, appDoc.data().financialStatus);
    const applicationPatch: DocumentData = {
      deanApproved: deanApprovalData.status === 'approved',
      overallStatus: summary.overallStatus,
      pendingCount: summary.pendingCount,
      approvedCount: summary.approvedCount,
      notApprovedCount: summary.notApprovedCount,
      printableAvailable: summary.printableAvailable,
      updatedAt: now,
    };
    if (typeof appDoc.data().deanApproved !== 'boolean') report.applicationsMissingDeanApproval++;
    await queueWrite((current) => current.update(appDoc.ref, applicationPatch));
    report.applicationsRecomputed++;
  }

  await flushBatch(batch, pendingWrites);
  if (options.verify) await verifyMigrationState();
  return report;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply after reviewing the migration plan.');
  }
  const report = await migrateAdviserToDean(options);
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('Adviser-to-Dean migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
