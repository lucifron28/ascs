import { spawnSync } from 'node:child_process';

/**
 * Playwright global setup: prepare a deterministic emulator dataset.
 * Runs the reset/seed pipeline in a tsx subprocess because Playwright's own
 * module loader does not honor the server-only require patch used by tsx.
 */
export default async function globalSetup() {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ascs11';
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'ascs11';

  console.log('🎭 Preparing Firebase Emulator Suite for E2E Acceptance Testing...');
  const result = spawnSync('npx tsx -r ./tests/helpers/mock-server-only.cjs scripts/reset-emulator.ts', {
    shell: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    timeout: 300_000,
  });
  if (result.status !== 0) {
    throw new Error(`Emulator reset/seed failed with exit code ${result.status}`);
  }
  console.log('✅ E2E environment prepared successfully.');
}
