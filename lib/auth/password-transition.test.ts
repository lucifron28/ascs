import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPasswordChangedResponse,
  getPasswordChangeRecovery,
} from './password-transition';

test('1. createPasswordChangedResponse sets status, Cache-Control, body, and cookie clearing header', async () => {
  const res = createPasswordChangedResponse(
    { error: 'Synchronization failed', accountDisabled: true },
    400,
    false
  );

  assert.equal(res.status, 400);
  assert.equal(res.headers.get('cache-control'), 'no-store');

  const body = await res.json();
  assert.equal(body.passwordChanged, true);
  assert.equal(body.accountDisabled, true);
  assert.equal(body.error, 'Synchronization failed');

  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie, 'Set-Cookie header must be set');
  assert.match(setCookie, /ascs_session=/);
  assert.match(setCookie, /Max-Age=0/i);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
});

test('2. createPasswordChangedResponse includes Secure flag in production', () => {
  const resProd = createPasswordChangedResponse({ success: true }, 200, true);
  const setCookie = resProd.headers.get('set-cookie');
  assert.ok(setCookie);
  assert.match(setCookie, /Secure/i);
});

test('3. getPasswordChangeRecovery leaves form state untouched on pre-password failure', () => {
  const recovery = getPasswordChangeRecovery(false, {
    error: 'Incorrect current password.',
    passwordChanged: false,
  });

  assert.equal(recovery.clearFields, false);
  assert.equal(recovery.signOut, false);
  assert.equal(recovery.redirectTo, null);
  assert.equal(recovery.message, 'Incorrect current password.');
});

test('4. getPasswordChangeRecovery clears fields, signs out, and redirects to login on post-password failure', () => {
  const recovery = getPasswordChangeRecovery(false, {
    error: 'Password changed, but token revocation failed.',
    passwordChanged: true,
  });

  assert.equal(recovery.clearFields, true);
  assert.equal(recovery.signOut, true);
  assert.equal(recovery.redirectTo, '/login');
  assert.equal(recovery.message, 'Password changed, but token revocation failed.');
});

test('5. getPasswordChangeRecovery handles successful password change redirect', () => {
  const recovery = getPasswordChangeRecovery(true, {
    passwordChanged: true,
  });

  assert.equal(recovery.clearFields, true);
  assert.equal(recovery.signOut, true);
  assert.equal(recovery.redirectTo, '/login');
  assert.equal(recovery.message, null);
});
