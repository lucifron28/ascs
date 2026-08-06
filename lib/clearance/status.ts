import type { ClearanceStatus, FinancialStatus } from '@/lib/types/status';

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
  // Filter out legacy Accountant approval rows so the Accountant is purely a financial gate
  const validApprovals = approvals.filter(
    (approval) => approval.signatoryRole !== 'accountant'
  );

  const pendingCount = validApprovals.filter((approval) => approval.status !== 'approved' && approval.status !== 'not_approved').length;
  const approvedCount = validApprovals.filter((approval) => approval.status === 'approved').length;
  const notApprovedCount = validApprovals.filter((approval) => approval.status === 'not_approved').length;

  let overallStatus: ClearanceStatus = 'pending';
  if (notApprovedCount > 0) {
    overallStatus = 'not_approved';
  } else if (validApprovals.length > 0 && pendingCount === 0) {
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
