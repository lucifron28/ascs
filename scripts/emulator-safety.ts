/**
 * Safety helper for the demo fixture writer.
 *
 * The default path is emulator-only. A remote seed is possible only when the
 * explicitly confirmed ASCS demo project is selected and the caller provides
 * real Admin credentials; emulator hosts and flags are rejected in that mode.
 */

const KNOWN_PRODUCTION_PROJECT_IDS = [
  'ascs-prod',
  'ascs-production',
  'pkm-ascs-prod',
  'lucifron28-ascs',
];

const CONFIRMED_REMOTE_DEMO_PROJECT_ID = 'ascs11';

export function assertEmulatorEnvironment(): {
  firestoreHost: string;
  authHost: string;
  projectId: string;
} {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    'ascs11';

  if (process.env.ASCS_ALLOW_REMOTE_DEMO_SEED === 'true') {
    if (useEmulator === 'true' || firestoreHost || authHost) {
      throw new Error(
        'REFUSING EXECUTION: Remote demo seeding cannot use Firebase emulator settings.'
      );
    }

    if (projectId !== CONFIRMED_REMOTE_DEMO_PROJECT_ID) {
      throw new Error(
        `REFUSING EXECUTION: Remote demo seeding is restricted to project "${CONFIRMED_REMOTE_DEMO_PROJECT_ID}".`
      );
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (
      !clientEmail ||
      !privateKey ||
      clientEmail.includes('xxxxx') ||
      privateKey.includes('...') ||
      privateKey.includes('YOUR_PRIVATE_KEY')
    ) {
      throw new Error(
        'REFUSING EXECUTION: Remote demo seeding requires a real Firebase Admin credential.'
      );
    }

    return {
      firestoreHost: 'remote',
      authHost: 'remote',
      projectId,
    };
  }

  if (!firestoreHost) {
    throw new Error(
      'REFUSING EXECUTION: FIRESTORE_EMULATOR_HOST is not defined. Emulator must be running.'
    );
  }

  if (!authHost) {
    throw new Error(
      'REFUSING EXECUTION: FIREBASE_AUTH_EMULATOR_HOST is not defined. Emulator must be running.'
    );
  }

  if (useEmulator !== 'true') {
    throw new Error(
      'REFUSING EXECUTION: NEXT_PUBLIC_USE_FIREBASE_EMULATOR is not set to "true".'
    );
  }

  if (KNOWN_PRODUCTION_PROJECT_IDS.includes(projectId.toLowerCase())) {
    throw new Error(
      `REFUSING EXECUTION: Project ID "${projectId}" is recognized as a production project.`
    );
  }

  return {
    firestoreHost,
    authHost,
    projectId,
  };
}
