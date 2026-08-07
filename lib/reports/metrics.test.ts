import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompletionRate,
  calculateApplicationMetrics,
  calculateFinancialMetrics,
  calculateRequirementMetrics,
  sortBottlenecks,
  calculateGroupMetrics,
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

test('4. calculateRequirementMetrics groups approvals and calculates unresolved counts', () => {
  const knownReqs = [
    { id: 'lib', role: 'librarian', label: 'Library Clearance' },
    { id: 'osa', role: 'osa_coordinator', label: 'OSA Clearance' },
  ];

  const approvals: RawApprovalData[] = [
    { requirementId: 'lib', signatoryRole: 'librarian', label: 'Library Clearance', status: 'approved' },
    { requirementId: 'lib', signatoryRole: 'librarian', label: 'Library Clearance', status: 'not_approved' },
    { requirementId: 'osa', signatoryRole: 'osa_coordinator', label: 'OSA Clearance', status: 'pending' },
  ];

  const metrics = calculateRequirementMetrics(approvals, knownReqs);
  assert.equal(metrics.length, 2);

  const osa = metrics.find((m) => m.requirementId === 'osa');
  assert.ok(osa);
  assert.equal(osa.totalAssigned, 1);
  assert.equal(osa.pending, 1);
  assert.equal(osa.unresolvedCount, 1);

  const lib = metrics.find((m) => m.requirementId === 'lib');
  assert.ok(lib);
  assert.equal(lib.totalAssigned, 2);
  assert.equal(lib.approved, 1);
  assert.equal(lib.notApproved, 1);
  assert.equal(lib.unresolvedCount, 1);
  assert.equal(lib.completionRate, 0.5);
});

test('5. sortBottlenecks sorts deterministically by unresolvedCount desc, notApproved desc, pending desc, label asc', () => {
  const unSorted = [
    { requirementId: '1', role: 'r1', label: 'Alpha Office', totalAssigned: 10, approved: 8, pending: 1, notApproved: 1, completionRate: 0.8, unresolvedCount: 2 },
    { requirementId: '2', role: 'r2', label: 'Beta Office', totalAssigned: 10, approved: 5, pending: 2, notApproved: 3, completionRate: 0.5, unresolvedCount: 5 },
    { requirementId: '3', role: 'r3', label: 'Gamma Office', totalAssigned: 10, approved: 5, pending: 4, notApproved: 1, completionRate: 0.5, unresolvedCount: 5 },
  ];

  const sorted = sortBottlenecks(unSorted);
  // Beta and Gamma both have unresolvedCount = 5. Beta has notApproved = 3, Gamma has notApproved = 1 -> Beta comes first.
  assert.equal(sorted[0].requirementId, '2');
  assert.equal(sorted[1].requirementId, '3');
  assert.equal(sorted[2].requirementId, '1');
});

test('6. calculateGroupMetrics aggregates data by program, yearLevel, or section', () => {
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
