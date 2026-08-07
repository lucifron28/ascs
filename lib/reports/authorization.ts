import type { UserRole } from '@/lib/types/roles';

export const VALID_REPORT_SCOPES = ['admin', 'dean', 'shared'] as const;
export type ReportScope = (typeof VALID_REPORT_SCOPES)[number];

export const REPORT_FILTER_SCOPES = ['admin', 'dean'] as const;
export type ReportFilterScope = (typeof REPORT_FILTER_SCOPES)[number];

export const MAX_REPORT_APPLICATIONS = 5000;

export interface UserAuthProfile {
  uid?: string;
  role?: string;
  accountStatus?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

/**
 * Asserts at runtime that the requested scope is valid and that the authenticated user profile is active,
 * has completed mandatory password change, and possesses the required role for the scope.
 * Throws an explicit authorization Error if any condition fails.
 */
export function assertReportScope(
  user: UserAuthProfile | null | undefined,
  requestedScope: unknown
): asserts requestedScope is ReportScope {
  if (
    typeof requestedScope !== 'string' ||
    !VALID_REPORT_SCOPES.includes(requestedScope as ReportScope)
  ) {
    throw new Error('Unauthorized: Invalid report scope.');
  }

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
  requestedScope: unknown
): { authorized: boolean; reason?: string } {
  try {
    assertReportScope(user, requestedScope);
    return { authorized: true };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Unauthorized';
    return { authorized: false, reason };
  }
}

/**
 * Parses and validates report filter scope argument at runtime ('admin' or 'dean').
 * Throws an Error if value is missing, not a string, or not in allowlist.
 */
export function parseReportFilterScope(value: unknown): ReportFilterScope {
  if (
    typeof value !== 'string' ||
    !REPORT_FILTER_SCOPES.includes(value as ReportFilterScope)
  ) {
    throw new Error('Invalid report filter scope.');
  }
  return value as ReportFilterScope;
}

/**
 * Asserts that the dataset size does not exceed the supported MAX_REPORT_APPLICATIONS limit of 5,000.
 */
export function assertReportDatasetWithinLimit(
  count: number,
  operation: 'summary' | 'export' | 'filter-options'
): void {
  if (count > MAX_REPORT_APPLICATIONS) {
    if (operation === 'filter-options') {
      throw new Error(
        'Reporting filter options exceed the supported 5,000-application range. Narrow or archive historical reporting data before generating filter options.'
      );
    }
    if (operation === 'export') {
      throw new Error(
        'The selected report export contains more than 5,000 submitted applications. Narrow the academic term or filters before exporting CSV.'
      );
    }
    throw new Error(
      'The selected report contains more than 5,000 submitted applications. Narrow the academic term or filters before generating the report.'
    );
  }
}
