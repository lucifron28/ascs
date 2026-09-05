import { getAdminAuth, getAdminFirestore } from '../lib/firebase/admin';
import type { QueryDocumentSnapshot, WriteBatch } from 'firebase-admin/firestore';

export const KNOWN_PRODUCTION_PROJECT_IDS = [
  'ascs-prod',
  'ascs-production',
  'pkm-ascs-prod',
  'lucifron28-ascs',
] as const;

export const CONFIRMED_REMOTE_DEMO_PROJECT_ID = 'ascs11';

export const SEQUENTIAL_DISPLAY_ORDERS: Record<string, number> = {
  librarian: 1,
  osa_coordinator: 3,
  guidance_counselor: 4,
  area_chair: 5,
  dean: 6,
};

export const NORMALIZED_DEAN_TITLE = 'Dean of Business Program';
export const NORMALIZED_DEAN_REQUIREMENT_LABEL = 'Dean Clearance';

export interface MigrationOptions {
  apply: boolean;
  verify?: boolean;
}

export interface RequirementDocData {
  id?: string;
  role: string;
  label?: string;
  displayOrder?: number;
  isActive?: boolean;
  assignedSignatoryId?: string | null;
  assignedSignatoryName?: string | null;
  responsibleTitle?: string | null;
  title?: string | null;
  createdAt?: string;
  updatedAt?: string;
  legacyOnly?: boolean;
  migrationTargetRole?: string;
  [key: string]: unknown;
}

export interface UserDocData {
  uid: string;
  role: string;
  fullName?: string;
  title?: string;
  jobTitle?: string;
  position?: string;
  roleTitle?: string;
  [key: string]: unknown;
}

export interface ApprovalDocData {
  requirementId?: string;
  signatoryRole?: string;
  status?: string;
  remarksLatest?: string | null;
  actedById?: string | null;
  actedByName?: string | null;
  actedAt?: string | null;
  signatoryTitle?: string | null;
  [key: string]: unknown;
}

export interface SequentialMigrationReport {
  dryRun: boolean;
  requirementsScanned: number;
  requirementsUpdated: number;
  usersScanned: number;
  usersUpdated: number;
  accountantRequirementsCreated: number;
  adviserRequirementsRestored: number;
  deanDecisionsFabricated: number;
  details: {
    requirementUpdates: Array<{
      id: string;
      role: string;
      before: Partial<RequirementDocData>;
      after: Partial<RequirementDocData>;
    }>;
    userUpdates: Array<{
      uid: string;
      role: string;
      before: Partial<UserDocData>;
      after: Partial<UserDocData>;
    }>;
  };
}

export function parseOptions(argv: string[]): MigrationOptions {
  return {
    apply: argv.includes('--apply'),
    verify: argv.includes('--verify'),
  };
}

/**
 * Guard every migration run against accidental production execution.
 * Secret-safe: never prints or leaks credentials.
 */
export function assertMigrationEnvironment(env: Record<string, string | undefined> = process.env): {
  isEmulator: boolean;
  projectId: string;
} {
  const firestoreHost = env.FIRESTORE_EMULATOR_HOST;
  const authHost = env.FIREBASE_AUTH_EMULATOR_HOST;
  const useEmulator = env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

  const projectId =
    env.FIREBASE_PROJECT_ID ||
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    env.GCLOUD_PROJECT ||
    (useEmulator || firestoreHost ? 'ascs11' : '');

  if (!projectId) {
    throw new Error('REFUSING EXECUTION: Firebase project ID cannot be determined.');
  }

  const isKnownProduction = KNOWN_PRODUCTION_PROJECT_IDS.some(
    (prodId) => prodId.toLowerCase() === projectId.toLowerCase()
  );
  if (isKnownProduction || projectId.toLowerCase().includes('prod')) {
    throw new Error(`REFUSING EXECUTION: Project "${projectId}" is recognized as a production project.`);
  }

  const isEmulatorEnv = Boolean(useEmulator || firestoreHost || authHost);

  if (isEmulatorEnv) {
    if (!firestoreHost && !authHost && !useEmulator) {
      throw new Error('REFUSING EXECUTION: Incomplete emulator configuration.');
    }
    return {
      isEmulator: true,
      projectId,
    };
  }

  // Remote target validation
  if (env.ASCS_ALLOW_REMOTE_DEMO_MIGRATION !== 'true') {
    throw new Error(
      'REFUSING EXECUTION: Set ASCS_ALLOW_REMOTE_DEMO_MIGRATION=true before running migrations against remote demo projects.'
    );
  }

  if (projectId !== CONFIRMED_REMOTE_DEMO_PROJECT_ID) {
    throw new Error(
      `REFUSING EXECUTION: Remote migration is strictly restricted to confirmed demo project "${CONFIRMED_REMOTE_DEMO_PROJECT_ID}".`
    );
  }

  const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = env.FIREBASE_PRIVATE_KEY || '';
  if (
    !clientEmail ||
    !privateKey ||
    clientEmail.includes('xxxxx') ||
    privateKey.includes('...') ||
    privateKey.includes('YOUR_PRIVATE_KEY')
  ) {
    throw new Error('REFUSING EXECUTION: A valid, non-placeholder Firebase Admin credential is required.');
  }

  return {
    isEmulator: false,
    projectId,
  };
}

/**
 * Computes displayOrder normalization and title updates for a clearance requirement.
 * Guarantees:
 * - Assigns sequential displayOrder (librarian: 1, osa: 3, guidance: 4, chair: 5, dean: 6).
 * - Preserves assignedSignatoryId and assignedSignatoryName (unless assignedSignatoryName was literally the job title 'Academic Dean').
 * - Preserves historical Adviser records (never reactivates adviser).
 * - Never creates or updates an Accountant requirement.
 */
export function normalizeRequirementDisplayOrder(
  req: RequirementDocData,
  nowIso?: string
): { updated: boolean; patch: Partial<RequirementDocData> | null } {
  // Never touch or reactivate adviser
  if (req.role === 'adviser') {
    return { updated: false, patch: null };
  }

  // Accountant is never a clearance requirement
  if (req.role === 'accountant') {
    return { updated: false, patch: null };
  }

  const targetDisplayOrder = SEQUENTIAL_DISPLAY_ORDERS[req.role];
  if (targetDisplayOrder === undefined) {
    return { updated: false, patch: null };
  }

  const patch: Partial<RequirementDocData> = {};
  let changed = false;

  if (req.displayOrder !== targetDisplayOrder) {
    patch.displayOrder = targetDisplayOrder;
    changed = true;
  }

  // Dean-specific title and label normalization
  if (req.role === 'dean') {
    if (req.label === 'Academic Dean' || req.label === 'Academic Dean Clearance') {
      patch.label = NORMALIZED_DEAN_REQUIREMENT_LABEL;
      changed = true;
    }

    if (req.responsibleTitle && req.responsibleTitle.trim() === 'Academic Dean') {
      patch.responsibleTitle = NORMALIZED_DEAN_TITLE;
      changed = true;
    }

    if (req.title && req.title.trim() === 'Academic Dean') {
      patch.title = NORMALIZED_DEAN_TITLE;
      changed = true;
    }

    // Only normalize assignedSignatoryName if it was literally the job title 'Academic Dean'
    // rather than a person's proper name (e.g. "Dr. Ronald Cruz" must not be overwritten).
    if (req.assignedSignatoryName && req.assignedSignatoryName.trim() === 'Academic Dean') {
      patch.assignedSignatoryName = NORMALIZED_DEAN_TITLE;
      changed = true;
    }
  }

  if (changed) {
    if (nowIso) {
      patch.updatedAt = nowIso;
    }
    return { updated: true, patch };
  }

  return { updated: false, patch: null };
}

/**
 * Normalizes user documents for the Dean role.
 * Preserves actual persons' names in `fullName`, only normalizing if `fullName`
 * was literally the placeholder job title 'Academic Dean'.
 */
export function normalizeUserDeanTitle(
  user: UserDocData,
  nowIso?: string
): { updated: boolean; patch: Partial<UserDocData> | null } {
  if (user.role !== 'dean') {
    return { updated: false, patch: null };
  }

  const patch: Partial<UserDocData> = {};
  let changed = false;

  if (user.fullName && user.fullName.trim() === 'Academic Dean') {
    patch.fullName = NORMALIZED_DEAN_TITLE;
    changed = true;
  }

  for (const field of ['title', 'jobTitle', 'position', 'roleTitle'] as const) {
    const val = user[field];
    if (typeof val === 'string' && val.trim() === 'Academic Dean') {
      patch[field] = NORMALIZED_DEAN_TITLE;
      changed = true;
    }
  }

  if (changed) {
    if (nowIso) {
      patch.updatedAt = nowIso;
    }
    return { updated: true, patch };
  }

  return { updated: false, patch: null };
}

/**
 * Invariant verification: Ensure no Accountant requirement document is created.
 */
export function assertNoAccountantRequirementCreated(targetRoles: string[]): void {
  if (targetRoles.includes('accountant')) {
    throw new Error('INVARIANT VIOLATION: An Accountant requirement document must not be created.');
  }
}

/**
 * Invariant verification: Ensure Adviser requirement is never active or reactivated.
 */
export function assertNoAdviserReactivation(requirements: RequirementDocData[]): void {
  for (const req of requirements) {
    if (req.role === 'adviser' && req.isActive === true) {
      throw new Error('INVARIANT VIOLATION: Adviser requirement is still active or was reactivated.');
    }
  }
}

/**
 * Invariant verification: Ensure no Dean decisions or remarks are fabricated or modified.
 */
export function assertNoFabricatedDeanDecision(input: {
  existingApproval?: ApprovalDocData | null;
  migratedApproval?: ApprovalDocData | null;
}): void {
  const { existingApproval, migratedApproval } = input;
  if (!existingApproval && migratedApproval) {
    if (migratedApproval.status && migratedApproval.status !== 'pending') {
      throw new Error('INVARIANT VIOLATION: Fabricated Dean decision detected on unreviewed clearance.');
    }
    if (migratedApproval.actedById || migratedApproval.actedByName || migratedApproval.actedAt) {
      throw new Error('INVARIANT VIOLATION: Fabricated Dean actor data detected.');
    }
  }

  if (existingApproval && migratedApproval) {
    if (existingApproval.status !== migratedApproval.status) {
      throw new Error(
        `INVARIANT VIOLATION: Dean decision status was modified from ${existingApproval.status} to ${migratedApproval.status}.`
      );
    }
    if (existingApproval.remarksLatest !== migratedApproval.remarksLatest) {
      throw new Error('INVARIANT VIOLATION: Dean remarks were modified.');
    }
    if (existingApproval.actedById !== migratedApproval.actedById) {
      throw new Error('INVARIANT VIOLATION: Dean actor ID was modified.');
    }
    if (existingApproval.actedByName !== migratedApproval.actedByName) {
      throw new Error('INVARIANT VIOLATION: Dean actor name was modified.');
    }
  }
}

async function flushBatch(batch: WriteBatch | null, pendingWrites: number): Promise<void> {
  if (batch && pendingWrites > 0) {
    await batch.commit();
  }
}

/**
 * Primary migration function.
 * Performs sequential displayOrder updates (1, 3, 4, 5, 6) and title normalization.
 * Requires options.apply = true to perform any writes.
 */
export async function migrateSequentialWorkflowMetadata(
  options: MigrationOptions
): Promise<SequentialMigrationReport> {
  assertMigrationEnvironment();

  const firestore = getAdminFirestore();
  const auth = getAdminAuth();
  const now = new Date().toISOString();

  const report: SequentialMigrationReport = {
    dryRun: !options.apply,
    requirementsScanned: 0,
    requirementsUpdated: 0,
    usersScanned: 0,
    usersUpdated: 0,
    accountantRequirementsCreated: 0,
    adviserRequirementsRestored: 0,
    deanDecisionsFabricated: 0,
    details: {
      requirementUpdates: [],
      userUpdates: [],
    },
  };

  let batch: WriteBatch | null = options.apply ? firestore.batch() : null;
  let pendingWrites = 0;

  const queueWrite = async (writer: (current: WriteBatch) => void) => {
    if (!batch) return;
    writer(batch);
    pendingWrites++;
    if (pendingWrites >= 400) {
      await flushBatch(batch, pendingWrites);
      batch = firestore.batch();
      pendingWrites = 0;
    }
  };

  // 1. Process clearanceRequirements
  const requirementsSnap = await firestore.collection('clearanceRequirements').get();
  report.requirementsScanned = requirementsSnap.size;

  const requirementDocs = requirementsSnap.docs.map((doc: QueryDocumentSnapshot) => ({
    id: doc.id,
    ...(doc.data() as RequirementDocData),
  }));

  assertNoAdviserReactivation(requirementDocs);

  for (const doc of requirementsSnap.docs) {
    const data = doc.data() as RequirementDocData;
    const { updated, patch } = normalizeRequirementDisplayOrder(data, now);

    if (updated && patch) {
      report.requirementsUpdated++;
      report.details.requirementUpdates.push({
        id: doc.id,
        role: data.role,
        before: {
          displayOrder: data.displayOrder,
          label: data.label,
          responsibleTitle: data.responsibleTitle,
          assignedSignatoryName: data.assignedSignatoryName,
        },
        after: patch,
      });

      await queueWrite((current) => current.set(doc.ref, patch, { merge: true }));
    }
  }

  // 2. Process users collection (specifically role: 'dean')
  const deanUsersSnap = await firestore.collection('users').where('role', '==', 'dean').get();
  report.usersScanned = deanUsersSnap.size;

  for (const doc of deanUsersSnap.docs) {
    const data: UserDocData = { ...(doc.data() as UserDocData), uid: doc.id };
    const { updated, patch } = normalizeUserDeanTitle(data, now);

    if (updated && patch) {
      report.usersUpdated++;
      report.details.userUpdates.push({
        uid: doc.id,
        role: data.role,
        before: {
          fullName: data.fullName,
          title: data.title,
          jobTitle: data.jobTitle,
        },
        after: patch,
      });

      await queueWrite((current) => current.set(doc.ref, patch, { merge: true }));

      // Also normalize Firebase Auth displayName only if it literally matched 'Academic Dean'
      if (options.apply && patch.fullName) {
        try {
          const authUser = await auth.getUser(doc.id);
          if (authUser.displayName && authUser.displayName.trim() === 'Academic Dean') {
            await auth.updateUser(doc.id, {
              displayName: NORMALIZED_DEAN_TITLE,
            });
          }
        } catch {
          // Account might only exist in Firestore or have custom auth mapping
        }
      }
    }
  }

  // 3. Commit any pending Firestore batch writes
  if (options.apply && batch) {
    await flushBatch(batch, pendingWrites);
  }

  // Invariant assertions
  assertNoAccountantRequirementCreated(
    report.details.requirementUpdates.map((u) => u.role)
  );

  return report;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (!options.apply) {
    console.log('[DRY-RUN] No writes performed. Pass --apply to execute migration changes.');
  }
  const report = await migrateSequentialWorkflowMetadata(options);
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('Sequential workflow migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
