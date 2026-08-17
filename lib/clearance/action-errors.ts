type ClearanceActionFallbacks = {
  fetchStudentDashboard: 'Unable to load your clearance status. Please try again.';
  fetchPendingApprovals: 'Unable to load the pending evaluation queue. Please try again.';
  fetchFinancialQueue: 'Unable to load financial records. Please try again.';
  signClearance: 'Unable to update the clearance decision. Please try again.';
  updateFinancialStatus: 'Unable to update the financial status. Please try again.';
};

export type ClearanceAction = keyof ClearanceActionFallbacks;

const SAFE_BUSINESS_MESSAGES = [
  /^(?:academic year, semester, and purpose are required fields\.)$/i,
  /^(?:already submitted a clearance application for .+\.)$/i,
  /^(?:no active clearance signatory requirements are configured\.)$/i,
  /^(?:application and approval identifiers are required\.)$/i,
  /^(?:invalid clearance approval status\.)$/i,
  /^(?:remarks are required when marking an approval as pending or not approved\.)$/i,
  /^(?:clearance approval record not found\.)$/i,
  /^(?:unauthorized: .+)$/i,
  /^(?:invalid financial status\.)$/i,
  /^(?:remarks are required when marking a student as 'unpaid'\.)$/i,
  /^(?:clearance application not found\.)$/i,
  /^(?:student profile record not found\. please contact administration\.)$/i,
  /^(?:password change required before accessing this operation\.)$/i,
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
}

/**
 * Keep infrastructure details server-side while preserving actionable domain
 * validation messages for the person performing the operation.
 */
export function mapClearanceActionError<T extends ClearanceAction>(
  action: T,
  error: unknown,
): ClearanceActionFallbacks[T] | string {
  const message = getErrorMessage(error).trim();
  if (message && SAFE_BUSINESS_MESSAGES.some((pattern) => pattern.test(message))) {
    return message;
  }

  return {
    fetchStudentDashboard: 'Unable to load your clearance status. Please try again.',
    fetchPendingApprovals: 'Unable to load the pending evaluation queue. Please try again.',
    fetchFinancialQueue: 'Unable to load financial records. Please try again.',
    signClearance: 'Unable to update the clearance decision. Please try again.',
    updateFinancialStatus: 'Unable to update the financial status. Please try again.',
  }[action];
}

export function logClearanceActionError(action: ClearanceAction, error: unknown): void {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'unknown';
  console.error(`[Clearance action] ${action} failed`, {
    code,
    message: getErrorMessage(error) || 'Unknown error',
  });
}
