import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserRole } from '@/lib/types/roles';
import { assertReportScope, checkReportRoleAuthorization } from './authorization';

test('1. Admin role can access Admin reports and shared scope', () => {
  const resAdmin = checkReportRoleAuthorization({ role: 'admin', accountStatus: 'active', isActive: true }, 'admin');
  assert.equal(resAdmin.authorized, true);
  assert.doesNotThrow(() => assertReportScope({ role: 'admin', accountStatus: 'active', isActive: true }, 'admin'));

  const resShared = checkReportRoleAuthorization({ role: 'admin', accountStatus: 'active', isActive: true }, 'shared');
  assert.equal(resShared.authorized, true);
});

test('2. Dean role cannot access Admin reports but can access Dean reports and shared scope', () => {
  const resAdmin = checkReportRoleAuthorization({ role: 'dean', accountStatus: 'active', isActive: true }, 'admin');
  assert.equal(resAdmin.authorized, false);
  assert.throws(
    () => assertReportScope({ role: 'dean', accountStatus: 'active', isActive: true }, 'admin'),
    /Only system administrators/
  );

  const resDean = checkReportRoleAuthorization({ role: 'dean', accountStatus: 'active', isActive: true }, 'dean');
  assert.equal(resDean.authorized, true);

  const resShared = checkReportRoleAuthorization({ role: 'dean', accountStatus: 'active', isActive: true }, 'shared');
  assert.equal(resShared.authorized, true);
});

test('3. Student role cannot access Admin, Dean, or shared filter option scopes', () => {
  const student = { role: 'student', accountStatus: 'active', isActive: true };
  assert.equal(checkReportRoleAuthorization(student, 'admin').authorized, false);
  assert.equal(checkReportRoleAuthorization(student, 'dean').authorized, false);
  assert.equal(checkReportRoleAuthorization(student, 'shared').authorized, false);
  assert.throws(() => assertReportScope(student, 'shared'), /Only administrators or the Academic Dean/);
});

test('4. Signatory roles (librarian, accountant, adviser, etc.) cannot access any report scopes', () => {
  const roles: UserRole[] = ['librarian', 'accountant', 'adviser', 'osa_coordinator', 'guidance_counselor', 'area_chair'];
  for (const role of roles) {
    const user = { role, accountStatus: 'active', isActive: true };
    assert.equal(checkReportRoleAuthorization(user, 'admin').authorized, false);
    assert.equal(checkReportRoleAuthorization(user, 'dean').authorized, false);
    assert.equal(checkReportRoleAuthorization(user, 'shared').authorized, false);
  }
});

test('5. Inactive Admin or Dean is blocked', () => {
  const inactiveAdmin = { role: 'admin', accountStatus: 'inactive', isActive: false };
  assert.equal(checkReportRoleAuthorization(inactiveAdmin, 'admin').authorized, false);
  assert.throws(() => assertReportScope(inactiveAdmin, 'admin'), /inactive/);

  const inactiveDean = { role: 'dean', accountStatus: 'inactive', isActive: false };
  assert.equal(checkReportRoleAuthorization(inactiveDean, 'dean').authorized, false);
});

test('6. Password-change-required user is blocked from all report scopes', () => {
  const pendingPasswordUser = { role: 'admin', accountStatus: 'active', isActive: true, mustChangePassword: true };
  assert.equal(checkReportRoleAuthorization(pendingPasswordUser, 'admin').authorized, false);
  assert.throws(() => assertReportScope(pendingPasswordUser, 'admin'), /Password change/);
});
