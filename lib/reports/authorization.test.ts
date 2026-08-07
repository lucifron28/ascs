import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserRole } from '@/lib/types/roles';

export function checkReportRoleAuthorization(
  user: { role?: string; accountStatus?: string; isActive?: boolean; mustChangePassword?: boolean } | null,
  requiredScope: 'admin' | 'dean'
): { authorized: boolean; reason?: string } {
  if (!user) {
    return { authorized: false, reason: 'No active session' };
  }

  if (user.accountStatus === 'inactive' || user.isActive === false) {
    return { authorized: false, reason: 'Account is inactive' };
  }

  if (user.mustChangePassword === true) {
    return { authorized: false, reason: 'Password change required' };
  }

  if (requiredScope === 'admin') {
    if (user.role !== 'admin') {
      return { authorized: false, reason: 'Unauthorized role for Admin reports' };
    }
  } else if (requiredScope === 'dean') {
    if (user.role !== 'dean') {
      return { authorized: false, reason: 'Unauthorized role for Dean reports' };
    }
  }

  return { authorized: true };
}

test('1. Admin role can access Admin reports', () => {
  const res = checkReportRoleAuthorization({ role: 'admin', accountStatus: 'active', isActive: true }, 'admin');
  assert.equal(res.authorized, true);
});

test('2. Dean role cannot access Admin reports', () => {
  const res = checkReportRoleAuthorization({ role: 'dean', accountStatus: 'active', isActive: true }, 'admin');
  assert.equal(res.authorized, false);
  assert.match(res.reason!, /Unauthorized role/);
});

test('3. Dean role can access Dean reports', () => {
  const res = checkReportRoleAuthorization({ role: 'dean', accountStatus: 'active', isActive: true }, 'dean');
  assert.equal(res.authorized, true);
});

test('4. Student role cannot access Admin or Dean reports', () => {
  assert.equal(checkReportRoleAuthorization({ role: 'student', accountStatus: 'active', isActive: true }, 'admin').authorized, false);
  assert.equal(checkReportRoleAuthorization({ role: 'student', accountStatus: 'active', isActive: true }, 'dean').authorized, false);
});

test('5. Signatory roles (librarian, accountant, adviser) cannot access Admin or Dean reports', () => {
  const roles: UserRole[] = ['librarian', 'accountant', 'adviser', 'osa_coordinator', 'guidance_counselor', 'area_chair'];
  for (const role of roles) {
    assert.equal(checkReportRoleAuthorization({ role, accountStatus: 'active', isActive: true }, 'admin').authorized, false);
    assert.equal(checkReportRoleAuthorization({ role, accountStatus: 'active', isActive: true }, 'dean').authorized, false);
  }
});

test('6. Inactive Admin or Dean is blocked', () => {
  const resAdmin = checkReportRoleAuthorization({ role: 'admin', accountStatus: 'inactive', isActive: false }, 'admin');
  assert.equal(resAdmin.authorized, false);
  assert.match(resAdmin.reason!, /inactive/);

  const resDean = checkReportRoleAuthorization({ role: 'dean', accountStatus: 'inactive', isActive: false }, 'dean');
  assert.equal(resDean.authorized, false);
});

test('7. Password-change-required user is blocked from reports', () => {
  const res = checkReportRoleAuthorization({ role: 'admin', accountStatus: 'active', isActive: true, mustChangePassword: true }, 'admin');
  assert.equal(res.authorized, false);
  assert.match(res.reason!, /Password change/);
});
