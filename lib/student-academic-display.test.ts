import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStudentAcademicSummary, matchesStudentSearch } from './student-academic-display';

test('formats canonical year levels as the compact dashboard label', () => {
  assert.equal(
    formatStudentAcademicSummary({ yearLevel: '1st Year', program: 'BSAIS', section: 'A' }),
    '1st yr. - BSAIS - A',
  );
});

test('searches academic fields together, ignoring case and extra spaces', () => {
  const record = ['Maria Santos', 'STUD-2026-0001', '1st Year', 'BSAIS', 'A'];

  assert.equal(matchesStudentSearch(' 1ST yr.   bsais A ', ...record), true);
  assert.equal(matchesStudentSearch('BSAIS 1st Year', ...record), true);
  assert.equal(matchesStudentSearch('1st yr. BSMA A', ...record), false);
  assert.equal(matchesStudentSearch('maria   santos', ...record), true);
  assert.equal(matchesStudentSearch('STUD-2026-0001', ...record), true);
  assert.equal(matchesStudentSearch('maria@example.test', 'Maria Santos', 'maria@example.test', 'msantos'), true);
  assert.equal(matchesStudentSearch('msantos', 'Maria Santos', 'maria@example.test', 'msantos'), true);
});

test('handles missing academic profile fields without throwing', () => {
  assert.equal(formatStudentAcademicSummary({}), '');
  assert.equal(matchesStudentSearch('1st yr. BSAIS A', undefined, null, ''), false);
  assert.equal(matchesStudentSearch('', undefined, null, ''), true);
});
