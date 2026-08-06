import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getClearanceStatusSummary,
  mapApprovalDocToStatus,
  validateApprovalStatus,
  validateFinancialStatus,
} from './status';

test('1. Any signatory not_approved produces overall not_approved', () => {
  const summary = getClearanceStatusSummary(
    [{ status: 'approved', signatoryRole: 'librarian' }, { status: 'not_approved', signatoryRole: 'adviser' }],
    'paid'
  );
  assert.equal(summary.overallStatus, 'not_approved');
  assert.equal(summary.printableAvailable, false);
});

test('2. All five required signatories approved plus financial paid produces approved', () => {
  const summary = getClearanceStatusSummary(
    [
      { status: 'approved', signatoryRole: 'librarian' },
      { status: 'approved', signatoryRole: 'osa_coordinator' },
      { status: 'approved', signatoryRole: 'guidance_counselor' },
      { status: 'approved', signatoryRole: 'area_chair' },
      { status: 'approved', signatoryRole: 'adviser' },
    ],
    'paid'
  );
  assert.equal(summary.overallStatus, 'approved');
  assert.equal(summary.printableAvailable, true);
});

test('3. All five required signatories approved plus financial unpaid produces not_approved', () => {
  const summary = getClearanceStatusSummary(
    [
      { status: 'approved', signatoryRole: 'librarian' },
      { status: 'approved', signatoryRole: 'osa_coordinator' },
      { status: 'approved', signatoryRole: 'guidance_counselor' },
      { status: 'approved', signatoryRole: 'area_chair' },
      { status: 'approved', signatoryRole: 'adviser' },
    ],
    'unpaid'
  );
  assert.equal(summary.overallStatus, 'not_approved');
  assert.equal(summary.printableAvailable, false);
});

test('4. A pending required signatory produces pending', () => {
  const summary = getClearanceStatusSummary(
    [
      { status: 'approved', signatoryRole: 'librarian' },
      { status: 'pending', signatoryRole: 'adviser' },
    ],
    'paid'
  );
  assert.equal(summary.overallStatus, 'pending');
  assert.equal(summary.printableAvailable, false);
});

test('5. Pending financial verification produces pending', () => {
  const summary = getClearanceStatusSummary(
    [
      { status: 'approved', signatoryRole: 'librarian' },
      { status: 'approved', signatoryRole: 'adviser' },
    ],
    'pending'
  );
  assert.equal(summary.overallStatus, 'pending');
  assert.equal(summary.printableAvailable, false);
});

test('6. Empty approval list cannot produce approval', () => {
  const summary = getClearanceStatusSummary([], 'paid');
  assert.equal(summary.overallStatus, 'pending');
  assert.equal(summary.printableAvailable, false);
});

test('7. Legacy pending Accountant approval is ignored when signatoryRole is provided', () => {
  const summary = getClearanceStatusSummary(
    [
      { status: 'approved', signatoryRole: 'librarian' },
      { status: 'approved', signatoryRole: 'osa_coordinator' },
      { status: 'approved', signatoryRole: 'guidance_counselor' },
      { status: 'approved', signatoryRole: 'area_chair' },
      { status: 'approved', signatoryRole: 'adviser' },
      { status: 'pending', signatoryRole: 'accountant' },
    ],
    'paid'
  );
  assert.equal(summary.overallStatus, 'approved');
  assert.equal(summary.printableAvailable, true);
});

test('8. Printable availability is true only for approved status', () => {
  const pendingSummary = getClearanceStatusSummary(
    [{ status: 'approved', signatoryRole: 'librarian' }],
    'pending'
  );
  assert.equal(pendingSummary.printableAvailable, false);

  const approvedSummary = getClearanceStatusSummary(
    [{ status: 'approved', signatoryRole: 'librarian' }],
    'paid'
  );
  assert.equal(approvedSummary.printableAvailable, true);
});

test('9. Mapping approval documents preserves status and signatoryRole', () => {
  const rawDocData = { status: 'approved', signatoryRole: 'librarian', id: 'approval-1' };
  const mapped = mapApprovalDocToStatus(rawDocData);
  assert.equal(mapped.status, 'approved');
  assert.equal(mapped.signatoryRole, 'librarian');

  const summary = getClearanceStatusSummary([mapped], 'paid');
  assert.equal(summary.overallStatus, 'approved');
});

test('10. Invalid financial status is rejected by validator', () => {
  assert.equal(validateFinancialStatus('paid'), true);
  assert.equal(validateFinancialStatus('unpaid'), true);
  assert.equal(validateFinancialStatus('pending'), false);
  assert.equal(validateFinancialStatus('unknown_status'), false);
  assert.equal(validateFinancialStatus(''), false);
});

test('11. Invalid signatory status is rejected by validator', () => {
  assert.equal(validateApprovalStatus('approved'), true);
  assert.equal(validateApprovalStatus('pending'), true);
  assert.equal(validateApprovalStatus('not_approved'), true);
  assert.equal(validateApprovalStatus('cleared'), false);
  assert.equal(validateApprovalStatus('rejected'), false);
  assert.equal(validateApprovalStatus(''), false);
});
