import { getAdminAuth, getAdminFirestore } from '../lib/firebase/admin';
import {
  getClearanceStatusSummary,
  REQUIRED_SIGNATORY_ROLES,
  VALID_APPROVAL_STATUSES,
} from '../lib/clearance/status';
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

export interface DeanApprovalMigrationInput {
  existingDeanApproval: Record<string, unknown> | null;
  legacyAdviserApproval: Record<string, unknown> | null;
  deanUid: string;
  deanName: string;
  now: string;
  legacyApprovalId?: string | null;
}

/**
 * Validate the audit marker used for a Dean row created from legacy Adviser
 * history. The marker is intentionally strict: a migrated Adviser-only row
 * may not carry a decision, remarks, timestamp, or actor identity. Once a
 * real Dean signs the row, signClearanceAction clears the marker.
 */
export function assertNoFabricatedDeanDecision(input: {
  deanApproval: Record<string, unknown>;
  legacyAdviserApproval: Record<string, unknown> | null;
}): void {
  if (input.deanApproval.migratedFromLegacyAdviser !== true) return;

  if (!input.legacyAdviserApproval) {
    throw new Error('Verification failed: a migrated Dean row has no retained legacy Adviser source row.');
  }

  const actionFields = ['remarksLatest', 'actedById', 'actedByName', 'actedAt'] as const;
  const copiedActionField = actionFields.find((field) => {
    const value = input.deanApproval[field];
    return value !== null && value !== undefined && value !== '';
  });

  if (input.deanApproval.status !== 'pending' || copiedActionField) {
    throw new Error(
      `Verification failed: Adviser-only migration fabricated a Dean decision${copiedActionField ? ` via ${copiedActionField}` : ''}.`,
    );
  }
}

/**
 * Build the Dean row without ever treating a legacy Adviser decision as a
 * Dean decision. Existing genuine Dean actions are preserved field-for-field
 * where possible; an Adviser-only migration always starts pending.
 */
export function buildDeanApprovalData(input: DeanApprovalMigrationInput): Record<string, unknown> {
  const existingDean = input.existingDeanApproval;
  if (existingDean) {
    const existingStatus = stringValue(existingDean.status, 'pending');
    return {
      ...existingDean,
      requirementId: 'dean',
      signatoryRole: 'dean',
      assignedSignatoryId: input.deanUid,
      assignedSignatoryName: input.deanName,
      status: (VALID_APPROVAL_STATUSES as readonly string[]).includes(existingStatus) ? existingStatus : 'pending',
      remarksLatest: existingDean.remarksLatest ?? null,
      actedById: existingDean.actedById ?? null,
      actedByName: existingDean.actedByName ?? null,
      actedAt: existingDean.actedAt ?? null,
      updatedAt: input.now,
    };
  }

  return {
    requirementId: 'dean',
    signatoryRole: 'dean',
    assignedSignatoryId: input.deanUid,
    assignedSignatoryName: input.deanName,
    status: 'pending',
    remarksLatest: null,
    actedById: null,
    actedByName: null,
    actedAt: null,
    updatedAt: input.now,
    ...(input.legacyApprovalId ? {
      legacySourceApprovalId: input.legacyApprovalId,
      migratedFromLegacyAdviser: true,
    } : {}),
  };
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
  const auth = getAdminAuth();
  const deanAuth = await auth.getUserByEmail(DEAN_EMAIL);
  const deanProfileSnap = await firestore.collection('users').doc(deanAuth.uid).get();
  const deanProfile = deanProfileSnap.data();
  if (!deanProfileSnap.exists || deanProfile?.role !== 'dean' || isInactive(deanProfile) || deanAuth.customClaims?.role !== 'dean') {
    throw new Error('Verification failed: the configured Academic Dean account is missing, inactive, or role-mismatched.');
  }

  const requirementsSnap = await firestore.collection('clearanceRequirements').get();
  const activeRequirements = requirementsSnap.docs.filter((doc) => doc.data().isActive !== false);
  const activeRoles = activeRequirements.map((doc) => String(doc.data().role));
  const uniqueActiveRoles = new Set(activeRoles);

  if (
    activeRequirements.length !== REQUIRED_SIGNATORY_ROLES.length ||
    uniqueActiveRoles.size !== REQUIRED_SIGNATORY_ROLES.length ||
    !REQUIRED_SIGNATORY_ROLES.every((role) => uniqueActiveRoles.has(role))
  ) {
    throw new Error(`Verification failed: expected exactly five active roles (${REQUIRED_SIGNATORY_ROLES.join(', ')}), got ${activeRoles.join(', ')}.`);
  }
  if (activeRoles.includes('adviser')) {
    throw new Error('Verification failed: Adviser requirement is still active.');
  }

  const orderedActiveRoles = [...activeRequirements]
    .sort((a, b) => Number(a.data().displayOrder || 999) - Number(b.data().displayOrder || 999))
    .map((doc) => String(doc.data().role));
  if (orderedActiveRoles.join('|') !== REQUIRED_SIGNATORY_ROLES.join('|')) {
    throw new Error(`Verification failed: active requirement order is ${orderedActiveRoles.join(', ')}.`);
  }

  const deanRequirement = activeRequirements.find((doc) => doc.data().role === 'dean');
  if (!deanRequirement || deanRequirement.data().label !== 'Dean Clearance') {
    throw new Error('Verification failed: Dean Clearance requirement is missing or mislabeled.');
  }
  if (deanRequirement.data().assignedSignatoryId !== deanAuth.uid) {
    throw new Error('Verification failed: Dean Clearance is not assigned to the active Academic Dean.');
  }

  const applicationsSnap = await firestore.collection('clearanceApplications').get();
  for (const app of applicationsSnap.docs) {
    const approvalsSnap = await app.ref.collection('approvals').get();
    const activeApprovals = approvalsSnap.docs.filter((doc) =>
      (REQUIRED_SIGNATORY_ROLES as readonly string[]).includes(String(doc.data().signatoryRole || '')),
    );
    const activeRoles = activeApprovals.map((doc) => String(doc.data().signatoryRole));
    const uniqueActiveRoles = new Set(activeRoles);
    if (activeApprovals.length !== REQUIRED_SIGNATORY_ROLES.length || uniqueActiveRoles.size !== REQUIRED_SIGNATORY_ROLES.length) {
      throw new Error(`Verification failed: application ${app.id} does not contain exactly five active approval roles.`);
    }

    const deanApproval = activeApprovals.find((doc) => doc.data().signatoryRole === 'dean');
    if (!deanApproval) throw new Error(`Verification failed: application ${app.id} is missing its Dean approval.`);

    const legacyAdviserApproval = approvalsSnap.docs.find((doc) =>
      doc.id === 'adviser' || doc.data().signatoryRole === 'adviser',
    );
    assertNoFabricatedDeanDecision({
      deanApproval: deanApproval.data(),
      legacyAdviserApproval: legacyAdviserApproval?.data() || null,
    });
    if (legacyAdviserApproval && (
      legacyAdviserApproval.data().legacyRetained !== true ||
      legacyAdviserApproval.data().legacyMigratedTo !== 'dean'
    )) {
      throw new Error(`Verification failed: application ${app.id} did not retain its legacy Adviser approval markers.`);
    }

    const appData = app.data();
    const expectedDeanApproved = deanApproval.data().status === 'approved';
    if (typeof appData.deanApproved !== 'boolean' || appData.deanApproved !== expectedDeanApproved) {
      throw new Error(`Verification failed: application ${app.id} has an inconsistent deanApproved flag.`);
    }

    const summary = getClearanceStatusSummary(
      activeApprovals.map((doc) => ({ status: doc.data().status, signatoryRole: doc.data().signatoryRole })),
      appData.financialStatus,
    );
    if (
      appData.overallStatus !== summary.overallStatus ||
      appData.pendingCount !== summary.pendingCount ||
      appData.approvedCount !== summary.approvedCount ||
      appData.notApprovedCount !== summary.notApprovedCount ||
      appData.printableAvailable !== summary.printableAvailable
    ) {
      throw new Error(`Verification failed: application ${app.id} counters or printable status are stale.`);
    }
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
  const adviserRequirements = requirementsSnap.docs.filter((doc) => doc.data().role === 'adviser');
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

  for (const adviserRequirement of adviserRequirements) {
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
    const deanApprovalRef = existingDeanDoc?.ref || appDoc.ref.collection('approvals').doc('dean');
    const deanApprovalData = buildDeanApprovalData({
      existingDeanApproval: existingDeanDoc?.data() || null,
      legacyAdviserApproval: legacyDoc?.data() || null,
      deanUid: deanAuth.uid,
      deanName,
      now,
      legacyApprovalId: legacyDoc?.id || null,
    });

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
