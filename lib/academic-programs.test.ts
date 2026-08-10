import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACADEMIC_PROGRAMS,
  ACADEMIC_PROGRAM_CODES,
  formatProgram,
  formatProgramNameFirst,
  getProgramName,
  isAcademicProgramCode,
} from './academic-programs';

test('PKM program catalog contains exactly the ten supported codes', () => {
  assert.deepEqual(ACADEMIC_PROGRAM_CODES, [
    'BSAIS',
    'BSMA',
    'BEED',
    'ENGLISH',
    'FILIPINO',
    'MATH',
    'SS',
    'CRIM',
    'ACP',
    'FSM',
  ]);
  assert.equal(Object.keys(ACADEMIC_PROGRAMS).length, 10);
});

test('PKM program code mappings and display helpers are canonical', () => {
  assert.equal(getProgramName('BSAIS'), 'Accounting Information System');
  assert.equal(getProgramName('FSM'), 'Food Service Management');
  assert.equal(formatProgram('BSAIS'), 'BSAIS — Accounting Information System');
  assert.equal(formatProgramNameFirst('BSAIS'), 'Accounting Information System (BSAIS)');
});

test('unknown or empty program values are handled without inventing catalog entries', () => {
  const legacyPlaceholder = 'BS' + 'IT';
  assert.equal(isAcademicProgramCode(legacyPlaceholder), false);
  assert.equal(getProgramName(legacyPlaceholder), legacyPlaceholder);
  assert.equal(formatProgram('legacy-code'), 'legacy-code');
  assert.equal(formatProgramNameFirst(''), 'Unspecified');
});
