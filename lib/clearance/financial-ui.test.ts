import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSaveFinancialDecision,
  getFinancialNotesDisplay,
  getInitialFinancialDecision,
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
