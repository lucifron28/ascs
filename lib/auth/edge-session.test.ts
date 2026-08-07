import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
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

  const certs2 = await fetchFirebasePublicCertificates(false, mockFetch);
  assert.equal(fetchCount, 1);
  assert.equal(certs2['kid-1'], 'cert-1');

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

test('6. Real RS256 signature verification succeeds with correct key and claims', async () => {
  clearCertificateCache();
  const { publicKey, privateKey } = await generateKeyPair('RS256');

  const mockFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ 'test-kid': 'cert-pem' }), { status: 200 });
  };

  const mockImportX509 = async () => publicKey;

  const token = await new SignJWT({
    role: 'admin',
    mustChangePassword: true,
    auth_time: Math.floor(Date.now() / 1000) - 10,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setSubject('uid-real-rs256')
    .setIssuer('https://session.firebase.google.com/ascs11')
    .setAudience('ascs11')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  // Uses real jose jwtVerify under the hood!
  const verified = await verifyFirebaseSessionCookie(token, 'ascs11', mockFetch, mockImportX509);

  assert.equal(verified.uid, 'uid-real-rs256');
  assert.equal(verified.role, 'admin');
  assert.equal(verified.mustChangePassword, true);
});

test('7. Real RS256 signature verification fails when signed with wrong private key', async () => {
  clearCertificateCache();
  const keyPairA = await generateKeyPair('RS256');
  const keyPairB = await generateKeyPair('RS256');

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ 'test-kid': 'cert-pem' }), { status: 200 });

  // Returns publicKey A, but token is signed with privateKey B
  const mockImportX509 = async () => keyPairA.publicKey;

  const token = await new SignJWT({
    role: 'student',
    auth_time: Math.floor(Date.now() / 1000) - 10,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setSubject('uid-wrong-key')
    .setIssuer('https://session.firebase.google.com/ascs11')
    .setAudience('ascs11')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(keyPairB.privateKey);

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch, mockImportX509),
    /signature verification failed/i
  );
});

test('8. Real RS256 verification fails when issuer is incorrect', async () => {
  clearCertificateCache();
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ 'test-kid': 'cert-pem' }), { status: 200 });
  const mockImportX509 = async () => publicKey;

  const token = await new SignJWT({
    role: 'student',
    auth_time: Math.floor(Date.now() / 1000) - 10,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setSubject('uid-wrong-issuer')
    .setIssuer('https://session.firebase.google.com/WRONG_PROJECT')
    .setAudience('ascs11')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch, mockImportX509),
    /unexpected "iss" claim value/i
  );
});

test('9. Real RS256 verification fails when audience is incorrect', async () => {
  clearCertificateCache();
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ 'test-kid': 'cert-pem' }), { status: 200 });
  const mockImportX509 = async () => publicKey;

  const token = await new SignJWT({
    role: 'student',
    auth_time: Math.floor(Date.now() / 1000) - 10,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setSubject('uid-wrong-audience')
    .setIssuer('https://session.firebase.google.com/ascs11')
    .setAudience('WRONG_AUDIENCE')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch, mockImportX509),
    /unexpected "aud" claim value/i
  );
});

test('10. Real RS256 verification fails when token is expired', async () => {
  clearCertificateCache();
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ 'test-kid': 'cert-pem' }), { status: 200 });
  const mockImportX509 = async () => publicKey;

  const token = await new SignJWT({
    role: 'student',
    auth_time: Math.floor(Date.now() / 1000) - 3600,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setSubject('uid-expired')
    .setIssuer('https://session.firebase.google.com/ascs11')
    .setAudience('ascs11')
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
    .sign(privateKey);

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch, mockImportX509),
    /"exp" claim timestamp check failed/i
  );
});

test('11. Real RS256 verification fails when subject is missing or empty', async () => {
  clearCertificateCache();
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ 'test-kid': 'cert-pem' }), { status: 200 });
  const mockImportX509 = async () => publicKey;

  const token = await new SignJWT({
    role: 'student',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer('https://session.firebase.google.com/ascs11')
    .setAudience('ascs11')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch, mockImportX509),
    /missing subject \(sub\)/i
  );
});

test('12. Real RS256 verification fails when auth_time is in the future', async () => {
  clearCertificateCache();
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ 'test-kid': 'cert-pem' }), { status: 200 });
  const mockImportX509 = async () => publicKey;

  const token = await new SignJWT({
    role: 'student',
    auth_time: Math.floor(Date.now() / 1000) + 3600, // 1 hour in future
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setSubject('uid-future-auth')
    .setIssuer('https://session.firebase.google.com/ascs11')
    .setAudience('ascs11')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  await assert.rejects(
    () => verifyFirebaseSessionCookie(token, 'ascs11', mockFetch, mockImportX509),
    /auth_time is in the future/i
  );
});
