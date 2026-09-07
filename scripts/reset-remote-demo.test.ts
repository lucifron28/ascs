import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseResetOptions,
  assertRemoteResetSafety,
  classifyAuthUser,
  classifyFirestoreUser,
  classifyFirestorePublicUser,
  classifyFirestoreStudent,
  classifyFirestoreRequirement,
  assertRecordsSafety,
  type UnexpectedAuthUser,
  type UnexpectedFirestoreRecord,
} from './reset-remote-demo';

test('parseResetOptions defaults to dry-run unless --apply is passed', () => {
  assert.equal(parseResetOptions([]).apply, false);
  assert.equal(parseResetOptions(['--dry-run']).apply, false);
  assert.equal(parseResetOptions(['--apply']).apply, true);
  assert.equal(parseResetOptions(['--dry-run', '--apply']).apply, true);
});

test('assertRemoteResetSafety rejects emulators, missing opt-in, or non-ascs11 projects', () => {
  const originalEnv = { ...process.env };

  try {
    // Rejects emulator flag
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    process.env.ASCS_ALLOW_REMOTE_DEMO_RESET = 'true';
    assert.throws(
      () => assertRemoteResetSafety('ascs11'),
      /Remote demo reset cannot run against Firebase emulators/
    );

    // Rejects other emulator environment hosts
    delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
    assert.throws(
      () => assertRemoteResetSafety('ascs11'),
      /Remote demo reset cannot run against Firebase emulators/
    );
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

    // Rejects missing opt-in
    delete process.env.ASCS_ALLOW_REMOTE_DEMO_RESET;
    assert.throws(
      () => assertRemoteResetSafety('ascs11'),
      /ASCS_ALLOW_REMOTE_DEMO_RESET=true is strictly required/
    );

    // Rejects wrong project
    process.env.ASCS_ALLOW_REMOTE_DEMO_RESET = 'true';
    assert.throws(
      () => assertRemoteResetSafety('other-project'),
      /Remote demo reset is restricted to project "ascs11"/
    );

    // Rejects production projects
    assert.throws(
      () => assertRemoteResetSafety('ascs-prod'),
      /Remote demo reset is restricted to project "ascs11"/
    );

    // Accepts valid ascs11 remote configuration
    assert.doesNotThrow(() => assertRemoteResetSafety('ascs11'));
  } finally {
    process.env = originalEnv;
  }
});

test('classifyAuthUser classifies demo users, stale adviser artifacts, and flags non-demo users', () => {
  // Canonical demo users
  const staff = classifyAuthUser({ uid: 'demo-librarian-uid', email: 'librarian@example.test', displayName: 'Librarian' });
  assert.equal(staff.isDemo, true);
  assert.equal(staff.isAdviser, false);

  const student = classifyAuthUser({ uid: 'demo-student-a-uid', email: 'student.a@example.test' });
  assert.equal(student.isDemo, true);
  assert.equal(student.isAdviser, false);

  // Stale adviser demo account is an expected demo artifact (does not flag unexpected)
  const adviser = classifyAuthUser({ uid: 'demo-adviser-uid', email: 'adviser@example.test', displayName: 'Adviser' });
  assert.equal(adviser.isDemo, true);
  assert.equal(adviser.isAdviser, true);

  // Clearly non-demo users
  const nonDemoGmail = classifyAuthUser({ uid: 'user-123', email: 'user@gmail.com', displayName: 'Real User' });
  assert.equal(nonDemoGmail.isDemo, false);
  assert.match(nonDemoGmail.reason || '', /does not match expected demo pattern/);

  const noEmail = classifyAuthUser({ uid: 'phone-user-456' });
  assert.equal(noEmail.isDemo, false);
  assert.match(noEmail.reason || '', /missing an email address/);
});

test('classifyFirestoreUser distinguishes demo users, adviser artifacts, and non-demo records', () => {
  // Canonical staff and student
  const dean = classifyFirestoreUser('demo-dean-uid', { email: 'dean@example.test', role: 'dean', fullName: 'Dean of Business Program' });
  assert.equal(dean.isDemo, true);
  assert.equal(dean.isAdviser, false);

  // Stale adviser demo record
  const adviser = classifyFirestoreUser('demo-adviser-uid', { email: 'adviser@example.test', role: 'adviser', fullName: 'Academic Adviser' });
  assert.equal(adviser.isDemo, true);
  assert.equal(adviser.isAdviser, true);

  // Foreign non-demo user doc
  const foreign = classifyFirestoreUser('user-real-999', { email: 'faculty@university.edu.ph', role: 'admin' });
  assert.equal(foreign.isDemo, false);
  assert.match(foreign.reason || '', /does not match "@example\.test"/);

  // Unrelated doc without demo UID
  const foreignNoEmail = classifyFirestoreUser('legacy-doc-123', {});
  assert.equal(foreignNoEmail.isDemo, false);
  assert.match(foreignNoEmail.reason || '', /does not start with "demo-"/);
});

test('classifyFirestorePublicUser flags non-demo public profile docs', () => {
  assert.equal(classifyFirestorePublicUser('demo-osa-uid', { role: 'osa_coordinator' }).isDemo, true);
  assert.equal(classifyFirestorePublicUser('demo-adviser-uid', { role: 'adviser' }).isDemo, true);

  const invalid = classifyFirestorePublicUser('external-uid', { role: 'student' });
  assert.equal(invalid.isDemo, false);
  assert.match(invalid.reason || '', /does not start with "demo-"/);
});

test('classifyFirestoreStudent recognizes demo students and flags foreign records', () => {
  const valid = classifyFirestoreStudent('demo-student-b-uid', {
    studentNumber: 'STUD-2026-0002',
    email: 'student.b@example.test',
  });
  assert.equal(valid.isDemo, true);

  const foreign = classifyFirestoreStudent('student-random-uid', {
    studentNumber: '2021-99999',
    email: 'real.student@gmail.com',
  });
  assert.equal(foreign.isDemo, false);
  assert.match(foreign.reason || '', /does not match "@example\.test"/);
});

test('classifyFirestoreRequirement permits canonical 5 roles + adviser, rejects foreign requirements', () => {
  for (const reqId of ['librarian', 'osa_coordinator', 'guidance_counselor', 'area_chair', 'dean']) {
    const res = classifyFirestoreRequirement(reqId, { role: reqId });
    assert.equal(res.isDemo, true);
    assert.equal(res.isAdviser, false);
  }

  // Stale adviser requirement is accepted as expected demo artifact
  const adviserReq = classifyFirestoreRequirement('adviser', { role: 'adviser', label: 'Adviser Clearance' });
  assert.equal(adviserReq.isDemo, true);
  assert.equal(adviserReq.isAdviser, true);

  // Foreign requirement triggers rejection
  const foreignReq = classifyFirestoreRequirement('athletics', { role: 'athletics', label: 'Athletics Clearance' });
  assert.equal(foreignReq.isDemo, false);
  assert.match(foreignReq.reason || '', /Unknown requirement ID "athletics"/);
});

test('assertRecordsSafety allows clean demo datasets and aborts on unexpected records', () => {
  // Empty unexpected records does not throw
  assert.doesNotThrow(() => assertRecordsSafety([], []));

  // Unexpected Auth user throws
  const badAuth: UnexpectedAuthUser[] = [
    { uid: 'bad-uid', email: 'intruder@gmail.com', reason: 'Non-demo email domain' },
  ];
  assert.throws(
    () => assertRecordsSafety(badAuth, []),
    /HARD SAFETY STOP: Found 1 unexpected non-demo record\(s\) \(1 Auth account\(s\), 0 Firestore record\(s\)\)/
  );

  // Unexpected Firestore record throws
  const badFirestore: UnexpectedFirestoreRecord[] = [
    { collection: 'clearanceRequirements', id: 'ssc_fee', reason: 'Unknown requirement ID' },
  ];
  assert.throws(
    () => assertRecordsSafety([], badFirestore),
    /HARD SAFETY STOP: Found 1 unexpected non-demo record\(s\) \(0 Auth account\(s\), 1 Firestore record\(s\)\)/
  );

  // Consolidated count when both exist
  assert.throws(
    () => assertRecordsSafety(badAuth, badFirestore),
    /HARD SAFETY STOP: Found 2 unexpected non-demo record\(s\) \(1 Auth account\(s\), 1 Firestore record\(s\)\)/
  );
});
