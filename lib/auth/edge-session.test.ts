import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCacheControlMaxAge,
  clearCertificateCache,
  fetchFirebasePublicCertificates,
  verifyFirebaseSessionCookie,
  FIREBASE_PUBLIC_CERTS_URL,
} from './edge-session';

test('1. parseCacheControlMaxAge parses max-age directive correctly', () => {
  assert.equal(parseCacheControlMaxAge(null), 3600);
  assert.equal(parseCacheControlMaxAge(undefined), 3600);
  assert.equal(parseCacheControlMaxAge('public, max-age=7200, must-revalidate'), 7200);
  assert.equal(parseCacheControlMaxAge('max-age=0'), 0);
  assert.equal(parseCacheControlMaxAge('no-cache'), 3600);
});

test('2. fetchFirebasePublicCertificates retrieves and caches certificates', async () => {
  clearCertificateCache();
  let fetchCount = 0;

  const mockFetch: typeof fetch = async (url) => {
    fetchCount++;
    assert.equal(String(url), FIREBASE_PUBLIC_CERTS_URL);
    return new Response(JSON.stringify({ 'kid-1': 'cert-1' }), {
      status: 200,
      headers: { 'cache-control': 'public, max-age=3600' },
    });
  };

  const certs1 = await fetchFirebasePublicCertificates(false, mockFetch);
  assert.equal(fetchCount, 1);
  assert.equal(certs1['kid-1'], 'cert-1');

  // Second call should hit memory cache
  const certs2 = await fetchFirebasePublicCertificates(false, mockFetch);
  assert.equal(fetchCount, 1);
  assert.equal(certs2['kid-1'], 'cert-1');

  // Force refresh should trigger new fetch
  const certs3 = await fetchFirebasePublicCertificates(true, mockFetch);
  assert.equal(fetchCount, 2);
  assert.equal(certs3['kid-1'], 'cert-1');
});

test('3. verifyFirebaseSessionCookie rejects non-RS256 algorithm', async () => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret';
  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11'),
    /expected RS256, got 'HS256'/
  );
});

test('4. verifyFirebaseSessionCookie rejects missing kid in header', async () => {
  const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.e30.sig';
  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11'),
    /missing key ID \(kid\)/
  );
});

test('5. verifyFirebaseSessionCookie handles unknown kid by re-fetching and rejecting', async () => {
  clearCertificateCache();
  let fetchCount = 0;

  const mockFetch: typeof fetch = async () => {
    fetchCount++;
    return new Response(JSON.stringify({ 'kid-known': 'cert-known' }), { status: 200 });
  };

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'kid-unknown' })).toString('base64url');
  const token = `${header}.e30.sig`;

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch),
    /Unknown certificate key ID: kid-unknown/
  );

  assert.equal(fetchCount, 2);
});

test('6. verifyFirebaseSessionCookie validates issuer, audience, sub, and claims using test verifier seam', async () => {
  clearCertificateCache();

  const mockFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ 'kid-test': 'cert-test-pem' }), { status: 200 });
  };

  const mockImportX509 = async (certPem: string) => {
    assert.equal(certPem, 'cert-test-pem');
    return { type: 'public-key' };
  };

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'kid-test' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'uid-12345',
      role: 'admin',
      mustChangePassword: true,
      auth_time: Math.floor(Date.now() / 1000) - 10,
    })
  ).toString('base64url');
  const token = `${header}.${payload}.sig`;

  // Mock jwtVerifyFn that verifies issuer and audience
  const mockJwtVerify = async (
    jwt: string,
    key: unknown,
    options?: { issuer?: string; audience?: string }
  ) => {
    assert.equal(jwt, token);
    assert.equal(options?.issuer, 'https://session.firebase.google.com/ascs11');
    assert.equal(options?.audience, 'ascs11');
    return {
      payload: {
        sub: 'uid-12345',
        role: 'admin',
        mustChangePassword: true,
        auth_time: Math.floor(Date.now() / 1000) - 10,
      },
      protectedHeader: { alg: 'RS256', kid: 'kid-test' },
    };
  };

  const verified = await verifyFirebaseSessionCookie(
    token,
    'ascs11',
    mockFetch,
    mockImportX509,
    mockJwtVerify
  );

  assert.equal(verified.uid, 'uid-12345');
  assert.equal(verified.role, 'admin');
  assert.equal(verified.mustChangePassword, true);
});

test('7. verifyFirebaseSessionCookie rejects missing or empty subject', async () => {
  clearCertificateCache();
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ 'kid-test': 'cert-test-pem' }), { status: 200 });
  const mockImportX509 = async () => ({ type: 'public-key' });

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'kid-test' })).toString('base64url');
  const token = `${header}.e30.sig`;

  const mockJwtVerifyEmptySub = async () => ({
    payload: { sub: '' },
    protectedHeader: { alg: 'RS256', kid: 'kid-test' },
  });

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch, mockImportX509, mockJwtVerifyEmptySub),
    /missing subject \(sub\)/
  );
});

test('8. verifyFirebaseSessionCookie rejects future auth_time', async () => {
  clearCertificateCache();
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ 'kid-test': 'cert-test-pem' }), { status: 200 });
  const mockImportX509 = async () => ({ type: 'public-key' });

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'kid-test' })).toString('base64url');
  const token = `${header}.e30.sig`;

  const mockJwtVerifyFutureAuth = async () => ({
    payload: {
      sub: 'uid-123',
      auth_time: Math.floor(Date.now() / 1000) + 3600, // 1 hour in future
    },
    protectedHeader: { alg: 'RS256', kid: 'kid-test' },
  });

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch, mockImportX509, mockJwtVerifyFutureAuth),
    /auth_time is in the future/
  );
});
