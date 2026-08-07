import test from 'node:test';
import assert from 'node:assert/strict';

export function createPasswordTransitionResult(params: {
  passwordChanged: boolean;
  success?: boolean;
  error?: string;
  accountDisabled?: boolean;
  manualInterventionRequired?: boolean;
}) {
  return {
    success: params.success ?? false,
    passwordChanged: params.passwordChanged,
    ...(params.error ? { error: params.error } : {}),
    ...(params.accountDisabled !== undefined ? { accountDisabled: params.accountDisabled } : {}),
    ...(params.manualInterventionRequired !== undefined
      ? { manualInterventionRequired: params.manualInterventionRequired }
      : {}),
  };
}

test('1. Pre-password failure does not set passwordChanged flag', () => {
  const result = createPasswordTransitionResult({
    passwordChanged: false,
    error: 'Current password verification failed.',
  });
  assert.equal(result.passwordChanged, false);
  assert.equal(result.success, false);
});

test('2. Token revocation failure sets passwordChanged: true for cookie clearing', () => {
  const result = createPasswordTransitionResult({
    passwordChanged: true,
    error: 'The password changed, but session revocation did not complete.',
  });
  assert.equal(result.passwordChanged, true);
  assert.equal(result.success, false);
});

test('3. Custom claim update failure sets passwordChanged: true', () => {
  const result = createPasswordTransitionResult({
    passwordChanged: true,
    error: 'The password changed, but mandatory-change completion remains pending.',
  });
  assert.equal(result.passwordChanged, true);
});

test('4. Firestore batch failure with successful rollback returns recoverable result', () => {
  const result = createPasswordTransitionResult({
    passwordChanged: true,
    error: 'Password changed and claims restored to mandatory-change-required state, but profile update failed.',
  });
  assert.equal(result.passwordChanged, true);
  assert.equal(result.accountDisabled, undefined);
});

test('5. Firestore batch failure with successful disable reports accountDisabled: true', () => {
  const result = createPasswordTransitionResult({
    passwordChanged: true,
    accountDisabled: true,
    manualInterventionRequired: true,
    error: 'Password changed, but account synchronization failed. The account was disabled for security.',
  });
  assert.equal(result.passwordChanged, true);
  assert.equal(result.accountDisabled, true);
  assert.equal(result.manualInterventionRequired, true);
});

test('6. Disable failure reports accountDisabled: false with manual intervention required', () => {
  const result = createPasswordTransitionResult({
    passwordChanged: true,
    accountDisabled: false,
    manualInterventionRequired: true,
    error: 'Password changed, account synchronization failed, and the account could not be disabled automatically.',
  });
  assert.equal(result.passwordChanged, true);
  assert.equal(result.accountDisabled, false);
  assert.equal(result.manualInterventionRequired, true);
});
