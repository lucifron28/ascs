import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmail,
  validateTemporaryPassword,
  validateRole,
  validateStudentInput,
  validateStaffInput,
  checkSelfOperation,
  checkFinalActiveAdmin,
  checkRoleConversion,
  sanitizeAuditMetadata,
  getAccountStatusFlags,
  shouldRedirectToChangePassword,
  generateRandomTemporaryPassword,
  mapLifecycleError,
} from './lifecycle-validation';
import type { UserRole } from '@/lib/types/roles';

test('1. Student account input validation sanitizes inputs', () => {
  const input = validateStudentInput({
    email: 'STUDENT@PKM.EDU.PH ',
    studentNumber: ' stud-2026-0001 ',
    fullName: ' Juan Dela Cruz ',
    program: ' BSAIS ',
    yearLevel: ' 4 ',
    section: ' A ',
  });

  assert.equal(input.email, 'student@pkm.edu.ph');
  assert.equal(input.studentNumber, 'STUD-2026-0001');
  assert.equal(input.fullName, 'Juan Dela Cruz');
  assert.equal(input.program, 'BSAIS');
  assert.equal(input.yearLevel, '4');
  assert.equal(input.section, 'A');
});

test('2. Staff-role validation accepts staff roles and rejects student', () => {
  assert.equal(validateRole('librarian'), 'librarian');
  assert.equal(validateRole('admin'), 'admin');

  assert.throws(
    () => validateStaffInput({ email: 'staff@pkm.edu.ph', fullName: 'Staff', role: 'student' as UserRole }),
    /Invalid role specified/
  );
});

test('3. Invalid email format is rejected', () => {
  assert.throws(() => validateEmail('invalid-email-address'), /Invalid email address format/);
  assert.throws(() => validateEmail(''), /Email address is required/);
});

test('4. Cryptographically generated temporary password satisfies security shape', () => {
  assert.throws(() => validateTemporaryPassword('short'), /at least 8 characters/);
  assert.equal(validateTemporaryPassword('validPassword123'), 'validPassword123');

  const set = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const pass = generateRandomTemporaryPassword();
    assert.ok(pass.length >= 12, `Password length ${pass.length} should be at least 12`);
    assert.match(pass, /[A-Z]/, 'Password must contain uppercase letters');
    assert.match(pass, /[a-z]/, 'Password must contain lowercase letters');
    assert.match(pass, /[0-9]/, 'Password must contain digits');
    assert.match(pass, /[!@#$%^&*]/, 'Password must contain symbols');
    set.add(pass);
  }

  // 100 iterations of random password generation must produce 100 distinct passwords
  assert.equal(set.size, 100, 'Cryptographic generator should produce unique values');
});

test('5. Student-required fields must be non-empty', () => {
  assert.throws(
    () => validateStudentInput({ email: 's@pkm.edu.ph', studentNumber: 'S-1', fullName: '', program: 'BSAIS', yearLevel: '1', section: 'A' }),
    /Full name is required/
  );
  assert.throws(
    () => validateStudentInput({ email: 's@pkm.edu.ph', studentNumber: 'S-1', fullName: 'Name', program: '', yearLevel: '1', section: 'A' }),
    /Program is required/
  );
});

test('6. Self-deactivation is rejected by safeguard', () => {
  assert.throws(
    () => checkSelfOperation('admin-123', 'admin-123', 'deactivation'),
    /cannot perform deactivation on your own administrator account/
  );
  assert.doesNotThrow(() => checkSelfOperation('admin-123', 'user-456', 'deactivation'));
});

test('7. Self-reset is rejected by safeguard', () => {
  assert.throws(
    () => checkSelfOperation('admin-123', 'admin-123', 'temporary password reset'),
    /cannot perform temporary password reset on your own administrator account/
  );
});

test('8. Final active administrator protection blocks deactivation', () => {
  assert.throws(() => checkFinalActiveAdmin(1), /Cannot deactivate or demote the final active system administrator/);
  assert.doesNotThrow(() => checkFinalActiveAdmin(2));
});

test('9. Student/staff role-conversion is blocked by safeguard', () => {
  assert.throws(
    () => checkRoleConversion('student', 'librarian'),
    /Changing between student and staff account types is not supported/
  );
  assert.throws(
    () => checkRoleConversion('admin', 'student'),
    /Changing between student and staff account types is not supported/
  );
  assert.doesNotThrow(() => checkRoleConversion('librarian', 'accountant'));
});

test('10. Temporary password never appears in audit metadata', () => {
  const unsafeMetadata = {
    email: 'user@pkm.edu.ph',
    password: 'UnsafePassword123',
    temporaryPassword: 'TempPassword123',
    token: 'secret-token-123',
    role: 'student',
    nested: {
      password: 'nested-pass',
      allowedField: 'safe-value',
    },
  };

  const sanitized = sanitizeAuditMetadata(unsafeMetadata);
  const rec = sanitized as Record<string, unknown>;
  const nested = rec.nested as Record<string, unknown>;
  assert.equal(rec.password, undefined);
  assert.equal(rec.temporaryPassword, undefined);
  assert.equal(rec.token, undefined);
  assert.equal(nested.password, undefined);
  assert.equal(nested.allowedField, 'safe-value');
});

test('11. Active and inactive status mappings stay synchronized', () => {
  const activeFlags = getAccountStatusFlags('active');
  assert.equal(activeFlags.accountStatus, 'active');
  assert.equal(activeFlags.isActive, true);

  const inactiveFlags = getAccountStatusFlags('inactive');
  assert.equal(inactiveFlags.accountStatus, 'inactive');
  assert.equal(inactiveFlags.isActive, false);
});

test('12. mustChangePassword redirect decision logic works correctly', () => {
  assert.equal(shouldRedirectToChangePassword({ mustChangePassword: true, accountStatus: 'active', isActive: true }), true);
  assert.equal(shouldRedirectToChangePassword({ mustChangePassword: false, accountStatus: 'active', isActive: true }), false);
  assert.equal(shouldRedirectToChangePassword({ mustChangePassword: true, accountStatus: 'inactive', isActive: false }), false);
  assert.equal(shouldRedirectToChangePassword(null), false);
});

test('13. Sensitive error mapping helper sanitizes internal errors', () => {
  assert.equal(
    mapLifecycleError(new Error('Firebase: The email address is already registered in Auth.')),
    'The specified email address is already registered.'
  );
  assert.equal(
    mapLifecycleError({ code: 'auth/user-not-found', message: 'User record missing' }),
    'Target user or authentication account not found.'
  );
  assert.equal(
    mapLifecycleError(new Error('Firebase auth error: weak-password')),
    'Password does not meet required security standards.'
  );
  assert.equal(
    mapLifecycleError(new Error('Action blocked: Cannot deactivate or demote the final active system administrator.')),
    'Action blocked: Cannot deactivate or demote the final active system administrator.'
  );
  assert.equal(
    mapLifecycleError(new Error('Firestore transaction partial failure during sync')),
    'Operation encountered a synchronization issue. Check system audit logs.'
  );
});
