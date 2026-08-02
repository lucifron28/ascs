import 'server-only';

import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase/admin';
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
