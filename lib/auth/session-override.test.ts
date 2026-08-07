import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { canUseTestSessionOverride, getSessionCookie } from './session';

describe('Test Session Override Security Guard', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows override when in acceptance test mode + emulators enabled + non-production', () => {
    process.env.ASCS_ACCEPTANCE_TEST_MODE = 'true';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.NODE_ENV = 'development';

    assert.equal(canUseTestSessionOverride(), true);
  });

  it('denies override when NODE_ENV is production', () => {
    process.env.ASCS_ACCEPTANCE_TEST_MODE = 'true';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.NODE_ENV = 'production';

    assert.equal(canUseTestSessionOverride(), false);
  });

  it('denies override when ASCS_ACCEPTANCE_TEST_MODE is missing or not "true"', () => {
    delete process.env.ASCS_ACCEPTANCE_TEST_MODE;
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.NODE_ENV = 'development';

    assert.equal(canUseTestSessionOverride(), false);
  });

  it('denies override when FIREBASE_AUTH_EMULATOR_HOST is missing', () => {
    process.env.ASCS_ACCEPTANCE_TEST_MODE = 'true';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.NODE_ENV = 'development';

    assert.equal(canUseTestSessionOverride(), false);
  });

  it('denies override when FIRESTORE_EMULATOR_HOST is missing', () => {
    process.env.ASCS_ACCEPTANCE_TEST_MODE = 'true';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    delete process.env.FIRESTORE_EMULATOR_HOST;
    process.env.NODE_ENV = 'development';

    assert.equal(canUseTestSessionOverride(), false);
  });

  it('denies override when NEXT_PUBLIC_USE_FIREBASE_EMULATOR is not "true"', () => {
    process.env.ASCS_ACCEPTANCE_TEST_MODE = 'true';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'false';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.NODE_ENV = 'development';

    assert.equal(canUseTestSessionOverride(), false);
  });

  it('re-throws error from cookies() when override is denied even if TEST_SESSION_COOKIE is set', async () => {
    process.env.TEST_SESSION_COOKIE = 'stale-test-session-cookie';
    delete process.env.ASCS_ACCEPTANCE_TEST_MODE; // Guard disabled

    await assert.rejects(
      async () => {
        await getSessionCookie();
      },
      (err: unknown) => {
        return err instanceof Error;
      }
    );
  });
});
