import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSaveFinancialDecision,
  getFinancialNotesDisplay,
  getInitialFinancialDecision,
  filterFinancialRecords,
  type FilterableFinancialRecord,
} from './financial-ui';

test('pending financial records open without a proposed decision', () => {
  assert.equal(getInitialFinancialDecision('pending'), null);
  assert.equal(canSaveFinancialDecision(null), false);
});

test('paid and unpaid financial records preserve their existing decision', () => {
  assert.equal(getInitialFinancialDecision('paid'), 'paid');
  assert.equal(getInitialFinancialDecision('unpaid'), 'unpaid');
  assert.equal(canSaveFinancialDecision('paid'), true);
  assert.equal(canSaveFinancialDecision('unpaid'), true);
});

test('financial queue copy reflects pending, paid, and unpaid semantics', () => {
  assert.equal(getFinancialNotesDisplay('pending', null), 'Pending financial review.');
  assert.notEqual(getFinancialNotesDisplay('pending', null), 'No outstanding balances.');
  assert.equal(getFinancialNotesDisplay('paid', null), 'No outstanding balances recorded.');
  assert.equal(getFinancialNotesDisplay('unpaid', null), 'Outstanding dues recorded.');
  assert.equal(getFinancialNotesDisplay('unpaid', '  PHP 5,000 due  '), 'PHP 5,000 due');
});

test('filterFinancialRecords partitions distinct datasets for each filter', () => {
  const sampleRecords: FilterableFinancialRecord[] = [
    // 1. Pending student: awaiting Accountant decision
    {
      status: 'pending',
      is_actionable: true,
      overall_status: 'pending',
      student_name: 'Alice Reyes',
      student_id_number: 'STUD-001',
      application_number: 'CLR-2026-001',
      program: 'BSAIS',
    },
    // 2. Unpaid student: outstanding balance recorded
    {
      status: 'unpaid',
      is_actionable: true,
      overall_status: 'not_approved',
      student_name: 'Bob Santos',
      student_id_number: 'STUD-002',
      application_number: 'CLR-2026-002',
      program: 'BSMA',
    },
    // 3. Paid but later stages incomplete: cleared at Accountant, awaiting subsequent signatories
    {
      status: 'paid',
      is_actionable: false,
      overall_status: 'pending',
      student_name: 'Clara Diaz',
      student_id_number: 'STUD-003',
      application_number: 'CLR-2026-003',
      program: 'CRIM',
    },
    // 4. Fully completed student: entire 6-stage workflow approved
    {
      status: 'paid',
      is_actionable: false,
      overall_status: 'approved',
      student_name: 'Daniel Cruz',
      student_id_number: 'STUD-004',
      application_number: 'CLR-2026-004',
      program: 'BEED',
    },
  ];

  // 1. All returns all 4 records
  const all = filterFinancialRecords(sampleRecords, 'all');
  assert.equal(all.length, 4);

  // 2. Pending returns only pending student
  const pending = filterFinancialRecords(sampleRecords, 'pending');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].student_name, 'Alice Reyes');

  // 3. Unpaid returns only unpaid student
  const unpaid = filterFinancialRecords(sampleRecords, 'unpaid');
  assert.equal(unpaid.length, 1);
  assert.equal(unpaid[0].student_name, 'Bob Santos');

  // 4. Paid / Cleared returns only paid students whose clearance is not yet fully completed
  const paid = filterFinancialRecords(sampleRecords, 'paid');
  assert.equal(paid.length, 1);
  assert.equal(paid[0].student_name, 'Clara Diaz');

  // 5. Completed History returns only finalized completed clearance records (overall_status === approved)
  const history = filterFinancialRecords(sampleRecords, 'history');
  assert.equal(history.length, 1);
  assert.equal(history[0].student_name, 'Daniel Cruz');

  // Verify Paid / Cleared and Completed History are not duplicates and have zero overlap
  const paidIds = new Set(paid.map((r) => r.student_id_number));
  const historyIds = new Set(history.map((r) => r.student_id_number));
  for (const id of paidIds) {
    assert.equal(historyIds.has(id), false, `Paid ID ${id} must not appear in Completed History`);
  }
  assert.notEqual(all.length, pending.length);
  assert.notEqual(paid.length, history.length === 0);
});

test('filterFinancialRecords searches accurately inside the selected filter', () => {
  const sampleRecords: FilterableFinancialRecord[] = [
    {
      status: 'pending',
      is_actionable: true,
      student_name: 'Maria Santos',
      student_id_number: 'STUD-101',
      application_number: 'CLR-2026-101',
      program: 'BSAIS',
    },
    {
      status: 'pending',
      is_actionable: true,
      student_name: 'Juan dela Cruz',
      student_id_number: 'STUD-102',
      application_number: 'CLR-2026-102',
      program: 'CRIM',
    },
    {
      status: 'paid',
      is_actionable: false,
      student_name: 'Maria Clara',
      student_id_number: 'STUD-103',
      application_number: 'CLR-2026-103',
      program: 'BSAIS',
    },
  ];

  // Search by name inside pending
  const searchName = filterFinancialRecords(sampleRecords, 'pending', 'Maria');
  assert.equal(searchName.length, 1);
  assert.equal(searchName[0].student_name, 'Maria Santos');

  // Search by student number inside pending
  const searchId = filterFinancialRecords(sampleRecords, 'pending', 'STUD-102');
  assert.equal(searchId.length, 1);
  assert.equal(searchId[0].student_name, 'Juan dela Cruz');

  // Search by application number inside all
  const searchApp = filterFinancialRecords(sampleRecords, 'all', 'CLR-2026-103');
  assert.equal(searchApp.length, 1);
  assert.equal(searchApp[0].student_name, 'Maria Clara');

  // Search by program code inside all
  const searchProg = filterFinancialRecords(sampleRecords, 'all', 'CRIM');
  assert.equal(searchProg.length, 1);
  assert.equal(searchProg[0].student_name, 'Juan dela Cruz');

  // Non-matching search returns empty
  const noMatch = filterFinancialRecords(sampleRecords, 'pending', 'NonExistent');
  assert.equal(noMatch.length, 0);
});
