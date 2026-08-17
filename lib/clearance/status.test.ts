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

test('all five approved plus pending financial verification remains pending', () => {
  const summary = getClearanceStatusSummary(
    REQUIRED_SIGNATORY_ROLES.map((signatoryRole) => ({ status: 'approved', signatoryRole })),
    'pending',
  );
  assert.equal(summary.overallStatus, 'pending');
  assert.equal(summary.pendingCount, 0);
  assert.equal(summary.approvedCount, 5);
  assert.equal(summary.notApprovedCount, 0);
  assert.equal(summary.printableAvailable, false);
});

test('four approved plus a missing Dean is pending and keeps five-role counts', () => {
  const summary = getClearanceStatusSummary(
    REQUIRED_SIGNATORY_ROLES
      .filter((role) => role !== 'dean')
      .map((signatoryRole) => ({ status: 'approved', signatoryRole })),
    'paid',
  );
  assert.deepEqual(summary, {
    overallStatus: 'pending',
    pendingCount: 1,
    approvedCount: 4,
    notApprovedCount: 0,
    printableAvailable: false,
  });
});

test('Dean not_approved wins over the other four approved roles', () => {
  const summary = getClearanceStatusSummary(
    [
      ...REQUIRED_SIGNATORY_ROLES
        .filter((role) => role !== 'dean')
        .map((signatoryRole) => ({ status: 'approved', signatoryRole })),
      { status: 'not_approved', signatoryRole: 'dean' },
    ],
    'paid',
  );
  assert.equal(summary.overallStatus, 'not_approved');
  assert.equal(summary.pendingCount, 0);
  assert.equal(summary.approvedCount, 4);
  assert.equal(summary.notApprovedCount, 1);
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

test('legacy Adviser approval cannot fill the missing fifth active role', () => {
  const summary = getClearanceStatusSummary(
    [
      ...REQUIRED_SIGNATORY_ROLES
        .filter((role) => role !== 'dean')
        .map((signatoryRole) => ({ status: 'approved', signatoryRole })),
      { status: 'approved', signatoryRole: 'adviser' },
    ],
    'paid',
  );
  assert.equal(summary.overallStatus, 'pending');
  assert.equal(summary.approvedCount, 4);
  assert.equal(summary.pendingCount, 1);
});

test('duplicate role rows count once and resolve conflicts conservatively', () => {
  const approvedDuplicate = getClearanceStatusSummary(
    [
      ...REQUIRED_SIGNATORY_ROLES.map((signatoryRole) => ({ status: 'approved', signatoryRole })),
      { status: 'approved', signatoryRole: 'librarian' },
    ],
    'paid',
  );
  assert.equal(approvedDuplicate.approvedCount, 5);
  assert.equal(approvedDuplicate.pendingCount, 0);
  assert.equal(approvedDuplicate.notApprovedCount, 0);
  assert.equal(approvedDuplicate.overallStatus, 'approved');

  const rejectedDuplicate = getClearanceStatusSummary(
    [
      ...REQUIRED_SIGNATORY_ROLES.map((signatoryRole) => ({ status: 'approved', signatoryRole })),
      { status: 'not_approved', signatoryRole: 'librarian' },
    ],
    'paid',
  );
  assert.equal(rejectedDuplicate.approvedCount, 4);
  assert.equal(rejectedDuplicate.pendingCount, 0);
  assert.equal(rejectedDuplicate.notApprovedCount, 1);
  assert.equal(rejectedDuplicate.overallStatus, 'not_approved');
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
