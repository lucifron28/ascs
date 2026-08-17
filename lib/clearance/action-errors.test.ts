import test from 'node:test';
import assert from 'node:assert/strict';
import { mapClearanceActionError } from './action-errors';

test('clearance infrastructure errors map to operation-specific safe copy', () => {
  assert.equal(
    mapClearanceActionError('fetchPendingApprovals', new Error('FAILED_PRECONDITION: missing collection-group index')),
    'Unable to load the pending evaluation queue. Please try again.',
  );
  assert.equal(
    mapClearanceActionError('fetchFinancialQueue', { code: 'internal', message: 'Firestore stack trace' }),
    'Unable to load financial records. Please try again.',
  );
});

test('clearance business validation errors remain specific', () => {
  assert.equal(
    mapClearanceActionError(
      'updateFinancialStatus',
      new Error("Remarks are required when marking a student as 'unpaid'."),
    ),
    "Remarks are required when marking a student as 'unpaid'.",
  );
  assert.equal(
    mapClearanceActionError('signClearance', new Error('Unauthorized: This approval is assigned to another signatory.')),
    'Unauthorized: This approval is assigned to another signatory.',
  );
});
