import test from 'node:test';
import assert from 'node:assert/strict';
import { getClearanceStatusSummary } from './status';

test('Rule 1: Any signatory not_approved produces overall not_approved', () => {
  const summary = getClearanceStatusSummary(
    [{ status: 'approved', signatoryRole: 'librarian' }, { status: 'not_approved', signatoryRole: 'adviser' }],
    'paid'
  );
  assert.equal(summary.overallStatus, 'not_approved');
  assert.equal(summary.printableAvailable, false);
});

test('Rule 2: All required signatories approved plus financial paid produces approved', () => {
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

test('Rule 3: All required signatories approved plus financial unpaid produces not_approved', () => {
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

test('Rule 4: A pending signatory produces pending', () => {
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

test('Rule 5: Pending financial verification produces pending', () => {
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

test('Rule 6: No approval rows cannot produce approved status', () => {
  const summary = getClearanceStatusSummary([], 'paid');
  assert.equal(summary.overallStatus, 'pending');
  assert.equal(summary.printableAvailable, false);
});

test('Rule 7: A legacy Accountant approval row does not block approval after financial-gate policy is applied', () => {
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

test('Rule 8: Printable availability is true only when overall status is approved', () => {
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
