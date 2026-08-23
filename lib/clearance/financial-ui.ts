import type { FinancialStatus } from '@/lib/types/status';

export type FinancialDecision = Exclude<FinancialStatus, 'pending'> | null;

/**
 * Return the explicit decision represented by a stored financial status.
 * Pending means that the accountant has not selected either outcome yet.
 */
export function getInitialFinancialDecision(status: FinancialStatus): FinancialDecision {
  return status === 'paid' || status === 'unpaid' ? status : null;
}

export function canSaveFinancialDecision(decision: FinancialDecision): decision is Exclude<FinancialDecision, null> {
  return decision === 'paid' || decision === 'unpaid';
}

/** Keep queue copy aligned with the meaning of each financial state. */
export function getFinancialNotesDisplay(status: FinancialStatus, notes: string | null | undefined): string {
  const trimmedNotes = notes?.trim();
  if (trimmedNotes) return trimmedNotes;
  if (status === 'pending') return 'Pending financial review.';
  if (status === 'unpaid') return 'Outstanding dues recorded.';
  return 'No outstanding balances recorded.';
}
