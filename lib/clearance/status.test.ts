import { getClearanceStatusSummary } from './status';

/**
 * Dependency-free unit test suite for the ASCS clearance status matrix.
 * Enforces business rules 1-5 from the FRD specification.
 */
export function runClearanceStatusTests() {
  const results: Array<{ name: string; passed: boolean; detail?: string }> = [];

  function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, detail: detail || 'Assertion failed' });
    }
  }

  // Rule 1: Any not_approved approval -> overall not_approved
  const r1 = getClearanceStatusSummary(
    [{ status: 'approved' }, { status: 'not_approved' }],
    'paid'
  );
  assert(
    'Rule 1: Any not_approved approval forces overall status to not_approved',
    r1.overallStatus === 'not_approved' && !r1.printableAvailable
  );

  // Rule 2: All approved and financial status paid -> overall approved
  const r2 = getClearanceStatusSummary(
    [{ status: 'approved' }, { status: 'approved' }],
    'paid'
  );
  assert(
    'Rule 2: All approved and financialStatus paid results in overall approved & printableAvailable',
    r2.overallStatus === 'approved' && r2.printableAvailable
  );

  // Rule 3: All approved but financial status unpaid -> overall not_approved
  const r3 = getClearanceStatusSummary(
    [{ status: 'approved' }, { status: 'approved' }],
    'unpaid'
  );
  assert(
    'Rule 3: All approved but financialStatus unpaid forces overall not_approved & not printable',
    r3.overallStatus === 'not_approved' && !r3.printableAvailable
  );

  // Rule 4: Pending approvals or pending financial status -> overall pending
  const r4a = getClearanceStatusSummary(
    [{ status: 'approved' }, { status: 'pending' }],
    'paid'
  );
  assert(
    'Rule 4a: Pending approval results in overall status pending',
    r4a.overallStatus === 'pending' && !r4a.printableAvailable
  );

  const r4b = getClearanceStatusSummary(
    [{ status: 'approved' }, { status: 'approved' }],
    'pending'
  );
  assert(
    'Rule 4b: Pending financial status results in overall status pending',
    r4b.overallStatus === 'pending' && !r4b.printableAvailable
  );

  // Rule 5: printableAvailable true ONLY when overall status is approved
  const r5 = getClearanceStatusSummary(
    [{ status: 'approved' }],
    'paid'
  );
  assert(
    'Rule 5: printableAvailable is true only when overall status is approved',
    r5.overallStatus === 'approved' && r5.printableAvailable === true
  );

  return results;
}
