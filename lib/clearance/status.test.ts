import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getClearanceStatusSummary,
  mapApprovalDocToStatus,
  validateApprovalStatus,
  validateFinancialStatus,
  REQUIRED_SIGNATORY_ROLES,
} from './status';

test('active signatory roles are exactly the five Dean workflow roles', () => {
  assert.deepEqual(REQUIRED_SIGNATORY_ROLES, [
    'librarian',
    'osa_coordinator',
    'guidance_counselor',
    'area_chair',
    'dean',
  ]);
  assert.equal(REQUIRED_SIGNATORY_ROLES.includes('adviser' as never), false);
});

test('any active signatory not_approved produces overall not_approved', () => {
  const summary = getClearanceStatusSummary(
    [{ status: 'approved', signatoryRole: 'librarian' }, { status: 'not_approved', signatoryRole: 'dean' }],
    'paid'
  );
  assert.equal(summary.overallStatus, 'not_approved');
  assert.equal(summary.printableAvailable, false);
});

test('all five active signatories approved plus financial paid produces approved', () => {
  const summary = getClearanceStatusSummary(
    REQUIRED_SIGNATORY_ROLES.map((signatoryRole) => ({ status: 'approved', signatoryRole })),
    'paid'
  );
  assert.equal(summary.overallStatus, 'approved');
  assert.equal(summary.approvedCount, 5);
  assert.equal(summary.printableAvailable, true);
});

test('all five active signatories approved plus financial unpaid is not printable', () => {
  const summary = getClearanceStatusSummary(
    REQUIRED_SIGNATORY_ROLES.map((signatoryRole) => ({ status: 'approved', signatoryRole })),
    'unpaid'
  );
  assert.equal(summary.overallStatus, 'not_approved');
  assert.equal(summary.printableAvailable, false);
});

test('pending signatory or financial verification blocks approval', () => {
  const summary = getClearanceStatusSummary(
    [{ status: 'approved', signatoryRole: 'librarian' }, { status: 'pending', signatoryRole: 'dean' }],
    'paid'
  );
  assert.equal(summary.overallStatus, 'pending');
  assert.equal(summary.printableAvailable, false);

  const financialPending = getClearanceStatusSummary(
    REQUIRED_SIGNATORY_ROLES.map((signatoryRole) => ({ status: 'approved', signatoryRole })),
    'pending'
  );
  assert.equal(financialPending.overallStatus, 'pending');
  assert.equal(financialPending.printableAvailable, false);
});

test('legacy Adviser and Accountant rows are ignored by active status calculations', () => {
  const summary = getClearanceStatusSummary(
    [
      ...REQUIRED_SIGNATORY_ROLES.map((signatoryRole) => ({ status: 'approved', signatoryRole })),
      { status: 'not_approved', signatoryRole: 'adviser' },
      { status: 'pending', signatoryRole: 'accountant' },
    ],
    'paid'
  );
  assert.equal(summary.overallStatus, 'approved');
  assert.equal(summary.printableAvailable, true);
});

test('empty approval list cannot produce approval', () => {
  const summary = getClearanceStatusSummary([], 'paid');
  assert.equal(summary.overallStatus, 'pending');
  assert.equal(summary.printableAvailable, false);
});

test('mapping approval documents preserves status and signatoryRole', () => {
  const mapped = mapApprovalDocToStatus({ status: 'approved', signatoryRole: 'librarian' });
  assert.equal(mapped.status, 'approved');
  assert.equal(mapped.signatoryRole, 'librarian');
});

test('validators reject unknown financial and approval statuses', () => {
  assert.equal(validateFinancialStatus('paid'), true);
  assert.equal(validateFinancialStatus('unpaid'), true);
  assert.equal(validateFinancialStatus('pending'), false);
  assert.equal(validateApprovalStatus('approved'), true);
  assert.equal(validateApprovalStatus('pending'), true);
  assert.equal(validateApprovalStatus('not_approved'), true);
  assert.equal(validateApprovalStatus('cleared'), false);
});
