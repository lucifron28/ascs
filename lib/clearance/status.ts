import type { ClearanceStatus, FinancialStatus } from '@/lib/types/status';
import { REQUIRED_SIGNATORY_ROLES } from '@/lib/clearance/workflow';

export { REQUIRED_SIGNATORY_ROLES } from '@/lib/clearance/workflow';

export interface ClearanceApprovalStatus {
  status?: ClearanceStatus | string | null;
  signatoryRole?: string | null;
}

export interface ClearanceStatusSummary {
  overallStatus: ClearanceStatus;
  pendingCount: number;
  approvedCount: number;
  notApprovedCount: number;
  printableAvailable: boolean;
}
export const VALID_APPROVAL_STATUSES = ['approved', 'pending', 'not_approved'] as const;
export const VALID_FINANCIAL_STATUSES = ['paid', 'unpaid'] as const;
const REQUIRED_SIGNATORY_ROLE_SET = new Set<string>(REQUIRED_SIGNATORY_ROLES);

export function validateApprovalStatus(status: string): boolean {
  return (VALID_APPROVAL_STATUSES as readonly string[]).includes(status);
}

export function validateFinancialStatus(status: string): boolean {
  return (VALID_FINANCIAL_STATUSES as readonly string[]).includes(status);
}

export function mapApprovalDocToStatus(docData: { status?: unknown; signatoryRole?: unknown }): ClearanceApprovalStatus {
  return {
    status: typeof docData.status === 'string' ? docData.status : null,
    signatoryRole: typeof docData.signatoryRole === 'string' ? docData.signatoryRole : null,
  };
}

/**
 * Derive the application status from the approval rows and financial flag.
 * A rejection always wins; a printable record is possible only for approved.
 */
export function getClearanceStatusSummary(
  approvals: readonly ClearanceApprovalStatus[],
  financialStatus: FinancialStatus | string | null | undefined,
): ClearanceStatusSummary {
  // Model one effective status for each of the five active roles. Missing,
  // malformed, or conflicting rows are conservative: pending wins over
  // approved, and not_approved wins over every other status. Accountant and
  // legacy Adviser rows remain outside the active signatory workflow.
  const effectiveStatuses = new Map<string, 'approved' | 'pending' | 'not_approved'>();
  const seenRoles = new Set<string>();
  for (const role of REQUIRED_SIGNATORY_ROLES) {
    effectiveStatuses.set(role, 'pending');
  }

  const precedence = { approved: 1, pending: 2, not_approved: 3 } as const;
  for (const approval of approvals) {
    const role = approval.signatoryRole || '';
    if (!REQUIRED_SIGNATORY_ROLE_SET.has(role)) continue;

    const normalizedStatus = validateApprovalStatus(String(approval.status))
      ? (approval.status as 'approved' | 'pending' | 'not_approved')
      : 'pending';
    const currentStatus = effectiveStatuses.get(role) || 'pending';
    if (!seenRoles.has(role) || precedence[normalizedStatus] > precedence[currentStatus]) {
      effectiveStatuses.set(role, normalizedStatus);
      seenRoles.add(role);
    }
  }

  const effective = Array.from(effectiveStatuses.values());
  const pendingCount = effective.filter((status) => status === 'pending').length;
  const approvedCount = effective.filter((status) => status === 'approved').length;
  const notApprovedCount = effective.filter((status) => status === 'not_approved').length;

  let overallStatus: ClearanceStatus = 'pending';
  if (notApprovedCount > 0) {
    overallStatus = 'not_approved';
  } else if (pendingCount === 0) {
    if (financialStatus === 'paid') {
      overallStatus = 'approved';
    } else if (financialStatus === 'unpaid') {
      overallStatus = 'not_approved';
    }
  }

  return {
    overallStatus,
    pendingCount,
    approvedCount,
    notApprovedCount,
    printableAvailable: overallStatus === 'approved',
  };
}

export function isPrintableClearance(
  approvals: readonly ClearanceApprovalStatus[],
  financialStatus: FinancialStatus | string | null | undefined,
) {
  return getClearanceStatusSummary(approvals, financialStatus).printableAvailable;
}
