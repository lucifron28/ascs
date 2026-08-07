import { getAdminAuth } from '../../lib/firebase/admin';
import { assertEmulatorEnvironment } from '../../scripts/emulator-safety';

export function setupTestEnvironment() {
  process.env.ASCS_ACCEPTANCE_TEST_MODE = 'true';
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ascs11';
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'ascs11';

  assertEmulatorEnvironment();
}

export function cleanupTestSessionCookie() {
  delete process.env.TEST_SESSION_COOKIE;
}

/**
 * Log in a user by email & password against the Auth Emulator and return a session cookie.
 */
export async function getSessionCookieForUser(email: string, password = 'password123'): Promise<string> {
  setupTestEnvironment();

  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const res = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to sign in user ${email} on Auth Emulator: ${errText}`);
  }

  const data = (await res.json()) as { idToken: string };
  const sessionCookie = await getAdminAuth().createSessionCookie(data.idToken, {
    expiresIn: 60 * 60 * 1000,
  });

  return sessionCookie;
}

/**
 * Get an ID token directly for client SDK or API route testing.
 */
export async function getIdTokenForUser(email: string, password = 'password123'): Promise<string> {
  setupTestEnvironment();

  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const res = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to get ID token for user ${email}: ${errText}`);
  }

  const data = (await res.json()) as { idToken: string };
  return data.idToken;
}
