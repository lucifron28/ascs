/**
 * Safety helper to ensure seed and reset scripts ONLY run against the Firebase Emulator Suite.
 * Prevents accidental execution against production Firebase projects.
 */

const KNOWN_PRODUCTION_PROJECT_IDS = [
  'ascs-prod',
  'ascs-production',
  'pkm-ascs-prod',
  'lucifron28-ascs',
];

export function assertEmulatorEnvironment(): {
  firestoreHost: string;
  authHost: string;
  projectId: string;
} {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;

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

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    'ascs11';

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
