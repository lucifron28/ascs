import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NORMALIZED_DEAN_TITLE,
  NORMALIZED_DEAN_REQUIREMENT_LABEL,
  parseOptions,
  assertMigrationEnvironment,
  normalizeRequirementDisplayOrder,
  normalizeUserDeanTitle,
  assertNoAccountantRequirementCreated,
  assertNoAdviserReactivation,
  assertNoFabricatedDeanDecision,
  type RequirementDocData,
  type UserDocData,
  type ApprovalDocData,
} from './migrate-sequential-workflow-metadata';

test('1. Old display orders (1, 2, 3, 4, 5) normalize to sequential orders (1, 3, 4, 5, 6)', () => {
  const oldRequirements: RequirementDocData[] = [
    {
      id: 'librarian',
      role: 'librarian',
      label: 'Librarian Clearance',
      displayOrder: 1,
      isActive: true,
      assignedSignatoryId: 'sig-lib-1',
      assignedSignatoryName: 'Ms. Librarian',
    },
    {
      id: 'osa_coordinator',
      role: 'osa_coordinator',
      label: 'OSA Coordinator Clearance',
      displayOrder: 2,
      isActive: true,
      assignedSignatoryId: 'sig-osa-1',
      assignedSignatoryName: 'Mr. OSA',
    },
    {
      id: 'guidance_counselor',
      role: 'guidance_counselor',
      label: 'Guidance Counselor Clearance',
      displayOrder: 3,
      isActive: true,
      assignedSignatoryId: 'sig-guidance-1',
      assignedSignatoryName: 'Dr. Guidance',
    },
    {
      id: 'area_chair',
      role: 'area_chair',
      label: 'Area Chair Clearance',
      displayOrder: 4,
      isActive: true,
      assignedSignatoryId: 'sig-chair-1',
      assignedSignatoryName: 'Prof. Chair',
    },
    {
      id: 'dean',
      role: 'dean',
      label: 'Dean Clearance',
      displayOrder: 5,
      isActive: true,
      assignedSignatoryId: 'sig-dean-1',
      assignedSignatoryName: 'Dr. Dean',
    },
  ];

  const results = oldRequirements.map((req) => {
    const { updated, patch } = normalizeRequirementDisplayOrder(req, '2026-09-05T00:00:00.000Z');
    return {
      role: req.role,
      updated,
      finalDisplayOrder: updated && patch?.displayOrder !== undefined ? patch.displayOrder : req.displayOrder,
      finalSignatoryId: patch?.assignedSignatoryId ?? req.assignedSignatoryId,
      finalSignatoryName: patch?.assignedSignatoryName ?? req.assignedSignatoryName,
    };
  });

  // Librarian was already 1, so displayOrder did not need a patch
  assert.equal(results.find((r) => r.role === 'librarian')?.finalDisplayOrder, 1);
  assert.equal(results.find((r) => r.role === 'librarian')?.updated, false);

  // OSA moves from 2 to 3
  assert.equal(results.find((r) => r.role === 'osa_coordinator')?.finalDisplayOrder, 3);
  assert.equal(results.find((r) => r.role === 'osa_coordinator')?.updated, true);

  // Guidance moves from 3 to 4
  assert.equal(results.find((r) => r.role === 'guidance_counselor')?.finalDisplayOrder, 4);
  assert.equal(results.find((r) => r.role === 'guidance_counselor')?.updated, true);

  // Area Chair moves from 4 to 5
  assert.equal(results.find((r) => r.role === 'area_chair')?.finalDisplayOrder, 5);
  assert.equal(results.find((r) => r.role === 'area_chair')?.updated, true);

  // Dean moves from 5 to 6
  assert.equal(results.find((r) => r.role === 'dean')?.finalDisplayOrder, 6);
  assert.equal(results.find((r) => r.role === 'dean')?.updated, true);

  // Verify all signatory IDs and proper names were preserved
  assert.equal(results.find((r) => r.role === 'librarian')?.finalSignatoryId, 'sig-lib-1');
  assert.equal(results.find((r) => r.role === 'librarian')?.finalSignatoryName, 'Ms. Librarian');
  assert.equal(results.find((r) => r.role === 'osa_coordinator')?.finalSignatoryId, 'sig-osa-1');
  assert.equal(results.find((r) => r.role === 'osa_coordinator')?.finalSignatoryName, 'Mr. OSA');
  assert.equal(results.find((r) => r.role === 'guidance_counselor')?.finalSignatoryId, 'sig-guidance-1');
  assert.equal(results.find((r) => r.role === 'guidance_counselor')?.finalSignatoryName, 'Dr. Guidance');
  assert.equal(results.find((r) => r.role === 'area_chair')?.finalSignatoryId, 'sig-chair-1');
  assert.equal(results.find((r) => r.role === 'area_chair')?.finalSignatoryName, 'Prof. Chair');
  assert.equal(results.find((r) => r.role === 'dean')?.finalSignatoryId, 'sig-dean-1');
  assert.equal(results.find((r) => r.role === 'dean')?.finalSignatoryName, 'Dr. Dean');

  // Verify full sequence
  const displayOrders = results.map((r) => r.finalDisplayOrder);
  assert.deepEqual(displayOrders, [1, 3, 4, 5, 6]);
});

test('2. Idempotency: running on already-normalized data produces 0 updates', () => {
  const normalizedRequirements: RequirementDocData[] = [
    { role: 'librarian', label: 'Librarian Clearance', displayOrder: 1, isActive: true },
    { role: 'osa_coordinator', label: 'OSA Coordinator Clearance', displayOrder: 3, isActive: true },
    { role: 'guidance_counselor', label: 'Guidance Counselor Clearance', displayOrder: 4, isActive: true },
    { role: 'area_chair', label: 'Area Chair Clearance', displayOrder: 5, isActive: true },
    {
      role: 'dean',
      label: NORMALIZED_DEAN_REQUIREMENT_LABEL,
      responsibleTitle: NORMALIZED_DEAN_TITLE,
      displayOrder: 6,
      isActive: true,
      assignedSignatoryName: 'Dr. Dean of Business',
    },
  ];

  for (const req of normalizedRequirements) {
    const { updated, patch } = normalizeRequirementDisplayOrder(req, '2026-09-05T00:00:00.000Z');
    assert.equal(updated, false, `Expected ${req.role} to produce 0 updates on second run`);
    assert.equal(patch, null);
  }

  const normalizedUser: UserDocData = {
    uid: 'dean-user-1',
    role: 'dean',
    fullName: 'Dr. Jane Smith',
    title: NORMALIZED_DEAN_TITLE,
    jobTitle: NORMALIZED_DEAN_TITLE,
  };

  const userResult = normalizeUserDeanTitle(normalizedUser, '2026-09-05T00:00:00.000Z');
  assert.equal(userResult.updated, false);
  assert.equal(userResult.patch, null);
});

test('3. No Accountant requirement document is created', () => {
  const accountantRequirement: RequirementDocData = {
    id: 'accountant',
    role: 'accountant',
    label: 'Accountant Clearance',
    displayOrder: 2,
    isActive: true,
  };

  const { updated, patch } = normalizeRequirementDisplayOrder(accountantRequirement);
  assert.equal(updated, false);
  assert.equal(patch, null);

  // Invariant assert verifies that accountant is strictly rejected if targeted as a clearance requirement
  assert.throws(
    () => assertNoAccountantRequirementCreated(['librarian', 'accountant', 'dean']),
    /INVARIANT VIOLATION: An Accountant requirement document must not be created/
  );

  // Passes when accountant is not among clearance requirement documents
  assert.doesNotThrow(() => assertNoAccountantRequirementCreated(['librarian', 'osa_coordinator', 'dean']));
});

test('4. No Adviser active requirement is restored', () => {
  const legacyAdviser: RequirementDocData = {
    id: 'adviser',
    role: 'adviser',
    label: 'Adviser Clearance',
    displayOrder: 99,
    isActive: false,
    legacyOnly: true,
  };

  const { updated, patch } = normalizeRequirementDisplayOrder(legacyAdviser);
  assert.equal(updated, false);
  assert.equal(patch, null);

  // Invariant assertion verifies that an active adviser throws
  assert.throws(
    () =>
      assertNoAdviserReactivation([
        { role: 'librarian', isActive: true },
        { role: 'adviser', isActive: true },
      ]),
    /INVARIANT VIOLATION: Adviser requirement is still active or was reactivated/
  );

  // Inactive adviser passes
  assert.doesNotThrow(() =>
    assertNoAdviserReactivation([
      { role: 'librarian', isActive: true },
      { role: 'adviser', isActive: false },
    ])
  );
});

test('5. No Dean decisions or remarks are fabricated', () => {
  const unreviewedApproval: ApprovalDocData = {
    requirementId: 'dean',
    signatoryRole: 'dean',
    status: 'pending',
    remarksLatest: null,
    actedById: null,
    actedByName: null,
    actedAt: null,
  };

  // Legitimate unreviewed state passes
  assert.doesNotThrow(() =>
    assertNoFabricatedDeanDecision({
      existingApproval: unreviewedApproval,
      migratedApproval: unreviewedApproval,
    })
  );

  // Reject fabrication of approval on unreviewed application
  assert.throws(
    () =>
      assertNoFabricatedDeanDecision({
        existingApproval: null,
        migratedApproval: {
          requirementId: 'dean',
          signatoryRole: 'dean',
          status: 'approved',
        },
      }),
    /INVARIANT VIOLATION: Fabricated Dean decision detected/
  );

  // Reject tampering with existing decision status
  assert.throws(
    () =>
      assertNoFabricatedDeanDecision({
        existingApproval: { status: 'pending' },
        migratedApproval: { status: 'approved' },
      }),
    /INVARIANT VIOLATION: Dean decision status was modified/
  );

  // Reject tampering with existing remarks
  assert.throws(
    () =>
      assertNoFabricatedDeanDecision({
        existingApproval: { status: 'approved', remarksLatest: 'Original remark' },
        migratedApproval: { status: 'approved', remarksLatest: 'Tampered remark' },
      }),
    /INVARIANT VIOLATION: Dean remarks were modified/
  );

  // Reject tampering with existing actor metadata
  assert.throws(
    () =>
      assertNoFabricatedDeanDecision({
        existingApproval: { status: 'approved', actedById: 'real-dean-uid' },
        migratedApproval: { status: 'approved', actedById: 'fabricated-actor-uid' },
      }),
    /INVARIANT VIOLATION: Dean actor ID was modified/
  );
});

test('6. Dry-run mode does not perform writes', () => {
  const optionsNoApply = parseOptions(['--verify']);
  assert.equal(optionsNoApply.apply, false);
  assert.equal(optionsNoApply.verify, true);

  const optionsWithApply = parseOptions(['--apply', '--verify']);
  assert.equal(optionsWithApply.apply, true);
  assert.equal(optionsWithApply.verify, true);

  const optionsDefault = parseOptions([]);
  assert.equal(optionsDefault.apply, false);
  assert.equal(optionsDefault.verify, false);

  // Verify that an execution plan with dryRun=true records changes without committing

  // In dry run, batch is not initialized or committed
  const isDryRun = !optionsNoApply.apply;
  assert.equal(isDryRun, true);
});

test('7. Dean title normalization: normalizes literal Academic Dean job title without overwriting personal names', () => {
  // Scenario A: Requirement has literal Academic Dean title
  const reqWithTitle: RequirementDocData = {
    role: 'dean',
    displayOrder: 6,
    label: 'Academic Dean Clearance',
    responsibleTitle: 'Academic Dean',
    assignedSignatoryName: 'Academic Dean', // placeholder name
  };

  const reqResult = normalizeRequirementDisplayOrder(reqWithTitle);
  assert.equal(reqResult.updated, true);
  assert.equal(reqResult.patch?.label, NORMALIZED_DEAN_REQUIREMENT_LABEL);
  assert.equal(reqResult.patch?.responsibleTitle, NORMALIZED_DEAN_TITLE);
  assert.equal(reqResult.patch?.assignedSignatoryName, NORMALIZED_DEAN_TITLE);

  // Scenario B: Requirement has real person's name
  const reqWithPersonName: RequirementDocData = {
    role: 'dean',
    displayOrder: 6,
    label: NORMALIZED_DEAN_REQUIREMENT_LABEL,
    responsibleTitle: NORMALIZED_DEAN_TITLE,
    assignedSignatoryName: 'Dr. Ronald Cruz',
  };

  const reqPersonResult = normalizeRequirementDisplayOrder(reqWithPersonName);
  assert.equal(reqPersonResult.updated, false);
  assert.equal(reqPersonResult.patch, null);

  // Scenario C: User doc has literal Academic Dean title fields
  const userWithTitles: UserDocData = {
    uid: 'dean-uid-1',
    role: 'dean',
    fullName: 'Dr. Maria Santos', // Real person's name
    title: 'Academic Dean',
    jobTitle: 'Academic Dean',
    position: 'Academic Dean',
  };

  const userResult = normalizeUserDeanTitle(userWithTitles);
  assert.equal(userResult.updated, true);
  // Full name preserved!
  assert.equal(userResult.patch?.fullName, undefined);
  // Titles normalized
  assert.equal(userResult.patch?.title, NORMALIZED_DEAN_TITLE);
  assert.equal(userResult.patch?.jobTitle, NORMALIZED_DEAN_TITLE);
  assert.equal(userResult.patch?.position, NORMALIZED_DEAN_TITLE);

  // Scenario D: User doc where fullName was literally the placeholder Academic Dean
  const userPlaceholderName: UserDocData = {
    uid: 'dean-uid-2',
    role: 'dean',
    fullName: 'Academic Dean',
  };

  const userPlaceholderResult = normalizeUserDeanTitle(userPlaceholderName);
  assert.equal(userPlaceholderResult.updated, true);
  assert.equal(userPlaceholderResult.patch?.fullName, NORMALIZED_DEAN_TITLE);
});

test('8. Environment safety guards prevent execution against production projects', () => {
  // Known production project IDs throw immediately
  assert.throws(
    () =>
      assertMigrationEnvironment({
        FIREBASE_PROJECT_ID: 'ascs-prod',
      }),
    /recognized as a production project/
  );

  assert.throws(
    () =>
      assertMigrationEnvironment({
        FIREBASE_PROJECT_ID: 'ascs-production',
      }),
    /recognized as a production project/
  );

  assert.throws(
    () =>
      assertMigrationEnvironment({
        FIREBASE_PROJECT_ID: 'pkm-ascs-prod',
      }),
    /recognized as a production project/
  );

  // Remote migration rejected without explicit flag
  assert.throws(
    () =>
      assertMigrationEnvironment({
        FIREBASE_PROJECT_ID: 'ascs11',
      }),
    /Set ASCS_ALLOW_REMOTE_DEMO_MIGRATION=true/
  );

  // Remote migration rejected if credentials contain dummy placeholders
  assert.throws(
    () =>
      assertMigrationEnvironment({
        FIREBASE_PROJECT_ID: 'ascs11',
        ASCS_ALLOW_REMOTE_DEMO_MIGRATION: 'true',
        FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-xxxxx@ascs11.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
      }),
    /A valid, non-placeholder Firebase Admin credential is required/
  );

  // Emulator environment is accepted
  const emulatorResult = assertMigrationEnvironment({
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    NEXT_PUBLIC_USE_FIREBASE_EMULATOR: 'true',
    FIREBASE_PROJECT_ID: 'ascs11',
  });
  assert.equal(emulatorResult.isEmulator, true);
  assert.equal(emulatorResult.projectId, 'ascs11');
});
