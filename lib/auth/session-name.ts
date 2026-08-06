/**
 * The single cookie name used by the browser session across route handlers,
 * server actions, and the optimistic route proxy.
 *
 * Keep this module free of server-only imports so it can also be bundled into
 * `proxy.ts`.
 */
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'ascs_session';

export function getSessionCookieName() {
  return process.env.SESSION_COOKIE_NAME || SESSION_COOKIE_NAME;
}
