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

export type AccountantFilterKey = 'all' | 'pending' | 'unpaid' | 'paid' | 'history';

export interface FilterableFinancialRecord {
  status: FinancialStatus | string;
  is_actionable?: boolean;
  is_history?: boolean;
  overall_status?: string;
  student_name?: string;
  student_id_number?: string;
  application_number?: string;
  program?: string | null;
}

/** Filter financial records by distinct status category and apply search query. */
export function filterFinancialRecords<T extends FilterableFinancialRecord>(
  records: T[],
  filter: AccountantFilterKey,
  searchQuery = ''
): T[] {
  let categoryMatches: T[];
  switch (filter) {
    case 'all':
      categoryMatches = records;
      break;
    case 'pending':
      categoryMatches = records.filter((r) => r.status === 'pending');
      break;
    case 'unpaid':
      categoryMatches = records.filter((r) => r.status === 'unpaid');
      break;
    case 'paid':
      categoryMatches = records.filter((r) => r.status === 'paid');
      break;
    case 'history':
      categoryMatches = records.filter(
        (r) => r.is_history === true || r.status === 'paid' || r.overall_status === 'approved'
      );
      break;
    default:
      categoryMatches = records;
  }

  const trimmedQuery = searchQuery.trim().toLowerCase();
  if (!trimmedQuery) return categoryMatches;

  return categoryMatches.filter((r) => {
    return Boolean(
      (r.student_name && r.student_name.toLowerCase().includes(trimmedQuery)) ||
      (r.student_id_number && r.student_id_number.toLowerCase().includes(trimmedQuery)) ||
      (r.application_number && r.application_number.toLowerCase().includes(trimmedQuery)) ||
      (r.program && r.program.toLowerCase().includes(trimmedQuery))
    );
  });
}
