import 'server-only';

import { cookies } from 'next/headers';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { getSessionCookieName, SESSION_COOKIE_NAME } from './session-name';

export { getSessionCookieName, SESSION_COOKIE_NAME };

/** Read the current HTTP-only session cookie in a Server Action/Route Handler. */
export async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(getSessionCookieName())?.value;
}

/** Verify the Firebase session cookie with revocation checks enabled. */
export async function verifySessionCookie(session?: string) {
  const sessionValue = session ?? await getSessionCookie();
  if (!sessionValue) {
    throw new Error('Unauthorized: No session cookie found.');
  }

  try {
    return await getAdminAuth().verifySessionCookie(sessionValue, true);
  } catch {
    throw new Error('Unauthorized: Invalid session.');
  }
}

/** Obtain the authenticated user UID from the session cookie. */
export async function getAuthUid(session?: string): Promise<string> {
  const decoded = await verifySessionCookie(session);
  return decoded.uid;
}

/**
 * Retrieve user profile from Firestore users/{uid} for an active authenticated session
 * without blocking password-change-required users.
 */
export async function getAuthenticatedUserForPasswordChange(session?: string) {
  const claims = await verifySessionCookie(session);
  const uid = claims.uid;

  const firestore = getAdminFirestore();
  const userDoc = await firestore.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    throw new Error('Unauthorized: User profile not found.');
  }

  const user = userDoc.data()!;
  if (user.accountStatus === 'inactive' || user.isActive === false) {
    throw new Error('Unauthorized: Account is inactive or deactivated.');
  }

  return { claims, uid, user };
}

/**
 * Verify session and retrieve user profile from Firestore users/{uid}.
 * Enforces that profile exists, user account is active, and mandatory password change is not pending.
 */
export async function getAuthenticatedUser(session?: string) {
  const result = await getAuthenticatedUserForPasswordChange(session);
  if (result.user.mustChangePassword === true) {
    throw new Error('Password change required before accessing this operation.');
  }

  return result;
}
