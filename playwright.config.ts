import { defineConfig, devices } from '@playwright/test';

const testBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3000';
const parsedTestURL = new URL(testBaseURL);
const testHost = parsedTestURL.hostname || '127.0.0.1';
const testPort = parsedTestURL.port || (parsedTestURL.protocol === 'https:' ? '443' : '80');

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './scripts/prepare-e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: testBaseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx next start -H ${testHost} -p ${testPort}`,
    url: testBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      NEXT_PUBLIC_USE_FIREBASE_EMULATOR: 'true',
      NEXT_PUBLIC_DEMO_MODE: 'true',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'ascs11',
      FIREBASE_PROJECT_ID: 'ascs11',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      SESSION_COOKIE_NAME: 'ascs_session',
    },
  },
});
