import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseResetOptions,
  assertRemoteResetSafety,
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
    // Rejects emulator
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    process.env.ASCS_ALLOW_REMOTE_DEMO_RESET = 'true';
    assert.throws(
      () => assertRemoteResetSafety('ascs11'),
      /Remote demo reset cannot run against Firebase emulators/
    );

    // Rejects missing opt-in
    delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;
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
