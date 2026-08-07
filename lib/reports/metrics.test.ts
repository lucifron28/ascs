import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompletionRate,
  calculateApplicationMetrics,
  calculateFinancialMetrics,
  calculateRequirementMetrics,
  sortBottlenecks,
  calculateGroupMetrics,
  deduplicateApplicationsById,
  type RawApplicationData,
  type RawApprovalData,
} from './metrics';

test('1. calculateCompletionRate returns 0 for zero denominator and handles normal ratios', () => {
  assert.equal(calculateCompletionRate(0, 0), 0);
  assert.equal(calculateCompletionRate(5, 0), 0);
  assert.equal(calculateCompletionRate(5, 10), 0.5);
  assert.equal(calculateCompletionRate(10, 10), 1.0);
  assert.equal(calculateCompletionRate(12, 10), 1.0); // capped at 1.0
});

test('2. calculateApplicationMetrics accurately counts statuses and calculates completion rate', () => {
  const emptyMetrics = calculateApplicationMetrics([]);
  assert.equal(emptyMetrics.total, 0);
  assert.equal(emptyMetrics.approved, 0);
  assert.equal(emptyMetrics.pending, 0);
  assert.equal(emptyMetrics.notApproved, 0);
  assert.equal(emptyMetrics.completionRate, 0);

  const apps: RawApplicationData[] = [
    { id: '1', overallStatus: 'approved' },
    { id: '2', overallStatus: 'approved' },
    { id: '3', overallStatus: 'pending' },
    { id: '4', overallStatus: 'not_approved' },
  ];

  const metrics = calculateApplicationMetrics(apps);
  assert.equal(metrics.total, 4);
  assert.equal(metrics.approved, 2);
  assert.equal(metrics.pending, 1);
  assert.equal(metrics.notApproved, 1);
  assert.equal(metrics.completionRate, 0.5);
});

test('3. calculateFinancialMetrics accurately counts paid, unpaid, and pending financial statuses', () => {
  const apps: RawApplicationData[] = [
    { id: '1', financialStatus: 'paid' },
    { id: '2', financialStatus: 'paid' },
    { id: '3', financialStatus: 'unpaid' },
    { id: '4', financialStatus: 'pending' },
  ];

  const fin = calculateFinancialMetrics(apps);
  assert.equal(fin.paid, 2);
  assert.equal(fin.unpaid, 1);
  assert.equal(fin.pending, 1);
});

test('4. deduplicateApplicationsById prevents double counting and throws on contradictory duplicates across all fields', () => {
  const duplicates: RawApplicationData[] = [
    { id: 'app-1', overallStatus: 'approved', financialStatus: 'paid', program: 'BSIT', yearLevel: '1', section: 'A', adviserApproved: true },
    { id: 'app-1', overallStatus: 'approved', financialStatus: 'paid', program: 'BSIT', yearLevel: '1', section: 'A', adviserApproved: true },
    { id: 'app-2', overallStatus: 'pending', financialStatus: 'pending', program: 'BSBA', yearLevel: '2', section: 'B', adviserApproved: false },
  ];

  const deduplicated = deduplicateApplicationsById(duplicates);
  assert.equal(deduplicated.length, 2);

  // Status conflict
  assert.throws(
    () => deduplicateApplicationsById([
      { id: 'a1', overallStatus: 'approved' },
      { id: 'a1', overallStatus: 'not_approved' },
    ]),
    /Contradictory records found for duplicate application ID/
  );

  // Financial status conflict
  assert.throws(
    () => deduplicateApplicationsById([
      { id: 'a1', financialStatus: 'paid' },
      { id: 'a1', financialStatus: 'unpaid' },
    ]),
    /Contradictory records found for duplicate application ID/
  );

  // Program conflict
  assert.throws(
    () => deduplicateApplicationsById([
      { id: 'a1', program: 'BSIT' },
      { id: 'a1', program: 'BSBA' },
    ]),
    /Contradictory records found for duplicate application ID/
  );

  // Year level conflict
  assert.throws(
    () => deduplicateApplicationsById([
      { id: 'a1', yearLevel: '1' },
      { id: 'a1', yearLevel: '2' },
    ]),
    /Contradictory records found for duplicate application ID/
  );

  // Section conflict
  assert.throws(
    () => deduplicateApplicationsById([
      { id: 'a1', section: 'A' },
      { id: 'a1', section: 'B' },
    ]),
    /Contradictory records found for duplicate application ID/
  );

  // Adviser approval conflict
  assert.throws(
    () => deduplicateApplicationsById([
      { id: 'a1', adviserApproved: true },
      { id: 'a1', adviserApproved: false },
    ]),
    /Contradictory records found for duplicate application ID/
  );
});

test('5. Unknown status throws data integrity error in application, financial, approval, and group metrics', () => {
  const invalidApp: RawApplicationData[] = [{ id: 'app-1', overallStatus: 'corrupted_status' }];
  assert.throws(() => calculateApplicationMetrics(invalidApp), /Unknown application overallStatus/);
  assert.throws(() => calculateGroupMetrics(invalidApp, 'program'), /Unknown application overallStatus/);

  const invalidFin: RawApplicationData[] = [{ id: 'app-1', financialStatus: 'corrupted_fin' }];
  assert.throws(() => calculateFinancialMetrics(invalidFin), /Unknown application financialStatus/);

  const invalidAppr: RawApprovalData[] = [
    { requirementId: 'lib', signatoryRole: 'librarian', status: 'corrupted_approval' },
  ];
  assert.throws(() => calculateRequirementMetrics(invalidAppr), /Unknown approval status/);
});

test('6. calculateRequirementMetrics handles 500+ applications and excludes accountant requirement role', () => {
  const knownReqs = [
    { id: 'lib', role: 'librarian', label: 'Library Clearance' },
    { id: 'acc', role: 'accountant', label: 'Accountant Clearance' }, // should be excluded
  ];

  const approvals: RawApprovalData[] = [];
  for (let i = 0; i < 600; i++) {
    approvals.push({
      requirementId: 'lib',
      signatoryRole: 'librarian',
      label: 'Library Clearance',
      status: i < 400 ? 'approved' : 'pending',
    });
    approvals.push({
      requirementId: 'acc',
      signatoryRole: 'accountant',
      label: 'Accountant Clearance',
      status: 'approved',
    });
  }

  const metrics = calculateRequirementMetrics(approvals, knownReqs);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].requirementId, 'lib');
  assert.equal(metrics[0].totalAssigned, 600);
  assert.equal(metrics[0].approved, 400);
  assert.equal(metrics[0].pending, 200);
  assert.equal(metrics[0].unresolvedCount, 200);
});

test('7. sortBottlenecks sorts deterministically by unresolvedCount desc, notApproved desc, pending desc, label asc', () => {
  const unSorted = [
    { requirementId: '1', role: 'r1', label: 'Alpha Office', totalAssigned: 10, approved: 8, pending: 1, notApproved: 1, completionRate: 0.8, unresolvedCount: 2 },
    { requirementId: '2', role: 'r2', label: 'Beta Office', totalAssigned: 10, approved: 5, pending: 2, notApproved: 3, completionRate: 0.5, unresolvedCount: 5 },
    { requirementId: '3', role: 'r3', label: 'Gamma Office', totalAssigned: 10, approved: 5, pending: 4, notApproved: 1, completionRate: 0.5, unresolvedCount: 5 },
  ];

  const sorted = sortBottlenecks(unSorted);
  assert.equal(sorted[0].requirementId, '2');
  assert.equal(sorted[1].requirementId, '3');
  assert.equal(sorted[2].requirementId, '1');
});

test('8. calculateGroupMetrics aggregates data by program, yearLevel, or section and handles duplicates', () => {
  const apps: RawApplicationData[] = [
    { id: '1', program: 'BSIT', yearLevel: '1', section: 'A', overallStatus: 'approved' },
    { id: '2', program: 'BSIT', yearLevel: '1', section: 'A', overallStatus: 'pending' },
    { id: '3', program: 'BSBA', yearLevel: '2', section: 'B', overallStatus: 'approved' },
  ];

  const progMetrics = calculateGroupMetrics(apps, 'program');
  assert.equal(progMetrics.length, 2);
  const bsit = progMetrics.find((g) => g.key === 'BSIT');
  assert.ok(bsit);
  assert.equal(bsit.total, 2);
  assert.equal(bsit.approved, 1);
  assert.equal(bsit.pending, 1);
  assert.equal(bsit.completionRate, 0.5);

  const secMetrics = calculateGroupMetrics(apps, 'section');
  assert.equal(secMetrics.length, 2);
});
