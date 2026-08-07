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
  // HS256 token
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret';
  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11'),
    /expected RS256, got 'HS256'/
  );
});

test('4. verifyFirebaseSessionCookie rejects missing kid in header', async () => {
  // RS256 token without kid in header
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

  // Header with unknown kid
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'kid-unknown' })).toString('base64url');
  const token = `${header}.e30.sig`;

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch),
    /Unknown certificate key ID: kid-unknown/
  );

  // Initial attempt + re-fetch on miss = 2 fetches
  assert.equal(fetchCount, 2);
});
