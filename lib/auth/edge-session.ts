import { decodeProtectedHeader, importX509, jwtVerify, type JWTPayload } from 'jose';

export interface VerifiedSessionPayload extends JWTPayload {
  uid: string;
  role: string;
  mustChangePassword?: boolean;
  auth_time?: number;
}

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let cachedCerts: CertCache | null = null;

export const FIREBASE_PUBLIC_CERTS_URL =
  'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';

export function parseCacheControlMaxAge(headerValue: string | null | undefined): number {
  if (!headerValue) return 3600;
  const match = headerValue.match(/max-age=(\d+)/i);
  return match ? parseInt(match[1], 10) : 3600;
}

export function clearCertificateCache(): void {
  cachedCerts = null;
}

export async function fetchFirebasePublicCertificates(
  forceRefresh = false,
  fetchFn: typeof fetch = fetch
): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && cachedCerts.expiresAt > now) {
    return cachedCerts.certs;
  }

  const response = await fetchFn(FIREBASE_PUBLIC_CERTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase public certificates (HTTP ${response.status}).`);
  }

  const certs = (await response.json()) as Record<string, string>;
  const maxAge = parseCacheControlMaxAge(response.headers.get('cache-control'));
  cachedCerts = {
    certs,
    expiresAt: now + maxAge * 1000,
  };

  return certs;
}

export async function verifyFirebaseSessionCookie(
  sessionCookie: string,
  projectId: string,
  fetchFn: typeof fetch = fetch,
  importX509Fn = importX509,
  jwtVerifyFn = jwtVerify
): Promise<VerifiedSessionPayload> {
  // 1. Decode header only
  const header = decodeProtectedHeader(sessionCookie);

  if (header.alg !== 'RS256') {
    throw new Error(`Invalid JWT header algorithm: expected RS256, got '${header.alg}'.`);
  }

  if (!header.kid || typeof header.kid !== 'string') {
    throw new Error('Invalid JWT header: missing key ID (kid).');
  }

  // 2. Fetch/select X.509 certificate with automatic cache refresh on miss
  let certs = await fetchFirebasePublicCertificates(false, fetchFn);
  let cert = certs[header.kid];

  if (!cert) {
    certs = await fetchFirebasePublicCertificates(true, fetchFn);
    cert = certs[header.kid];
  }

  if (!cert) {
    throw new Error(`Unknown certificate key ID: ${header.kid}`);
  }

  // 3. Import X.509 certificate & verify signature + claims
  const publicKey = await importX509Fn(cert, 'RS256');

  const expectedIssuer = `https://session.firebase.google.com/${projectId}`;
  const { payload } = await jwtVerifyFn(sessionCookie, publicKey, {
    issuer: expectedIssuer,
    audience: projectId,
  });

  // 4. Validate required claims
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid session cookie payload: missing subject (sub).');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSeconds + 300) {
    throw new Error('Invalid session cookie payload: auth_time is in the future.');
  }

  return {
    ...payload,
    uid: payload.sub,
    role: (payload.role as string) || 'student',
    mustChangePassword: payload.mustChangePassword === true,
  };
}
