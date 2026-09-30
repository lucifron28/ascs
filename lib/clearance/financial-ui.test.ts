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
    {
      status: 'pending',
      is_actionable: true,
      student_name: 'Alice Reyes',
      student_id_number: 'STUD-001',
      application_number: 'CLR-2026-001',
      program: 'BSAIS',
    },
    {
      status: 'unpaid',
      is_actionable: true,
      student_name: 'Bob Santos',
      student_id_number: 'STUD-002',
      application_number: 'CLR-2026-002',
      program: 'BSMA',
    },
    {
      status: 'paid',
      is_actionable: false,
      is_history: true,
      overall_status: 'approved',
      student_name: 'Charlie Cruz',
      student_id_number: 'STUD-003',
      application_number: 'CLR-2026-003',
      program: 'BEED',
    },
  ];

  // 1. All returns all 3 records
  const all = filterFinancialRecords(sampleRecords, 'all');
  assert.equal(all.length, 3);

  // 2. Pending returns only pending
  const pending = filterFinancialRecords(sampleRecords, 'pending');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].student_name, 'Alice Reyes');
  assert.notEqual(all.length, pending.length);

  // 3. Unpaid returns only unpaid
  const unpaid = filterFinancialRecords(sampleRecords, 'unpaid');
  assert.equal(unpaid.length, 1);
  assert.equal(unpaid[0].student_name, 'Bob Santos');

  // 4. Paid returns only paid
  const paid = filterFinancialRecords(sampleRecords, 'paid');
  assert.equal(paid.length, 1);
  assert.equal(paid[0].student_name, 'Charlie Cruz');

  // 5. History returns completed history records
  const history = filterFinancialRecords(sampleRecords, 'history');
  assert.equal(history.length, 1);
  assert.equal(history[0].student_name, 'Charlie Cruz');
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
