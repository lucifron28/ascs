import type { UserRole } from '@/lib/types/roles';

export type ReportScope = 'admin' | 'dean' | 'shared';

export interface UserAuthProfile {
  uid?: string;
  role?: string;
  accountStatus?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

/**
 * Asserts that the authenticated user profile is active, has completed mandatory password change,
 * and possesses the required role for the requested report scope ('admin', 'dean', or 'shared').
 * Throws an explicit authorization Error if any condition fails.
 */
export function assertReportScope(
  user: UserAuthProfile | null | undefined,
  requestedScope: ReportScope
): void {
  if (!user) {
    throw new Error('Unauthorized: No active session found.');
  }

  if (user.accountStatus === 'inactive' || user.isActive === false) {
    throw new Error('Unauthorized: Account is inactive or deactivated.');
  }

  if (user.mustChangePassword === true) {
    throw new Error('Password change required before accessing reporting operations.');
  }

  const role = user.role as UserRole | undefined;

  if (requestedScope === 'admin') {
    if (role !== 'admin') {
      throw new Error('Unauthorized: Only system administrators can access Admin reports.');
    }
  } else if (requestedScope === 'dean') {
    if (role !== 'dean') {
      throw new Error('Unauthorized: Only the Academic Dean can access Dean clearance reports.');
    }
  } else if (requestedScope === 'shared') {
    if (role !== 'admin' && role !== 'dean') {
      throw new Error('Unauthorized: Only administrators or the Academic Dean can access reporting filter options.');
    }
  }
}

/**
 * Non-throwing authorization check helper returning an outcome status object.
 */
export function checkReportRoleAuthorization(
  user: UserAuthProfile | null | undefined,
  requestedScope: ReportScope
): { authorized: boolean; reason?: string } {
  try {
    assertReportScope(user, requestedScope);
    return { authorized: true };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Unauthorized';
    return { authorized: false, reason };
  }
}
