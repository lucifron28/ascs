import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReportFilters,
  getDefaultAcademicYear,
  getDefaultSemester,
} from './filters';

test('1. parseReportFilters accepts valid academic year and semester', () => {
  const filters = parseReportFilters({
    academicYear: '2026-2027',
    semester: '2nd Semester',
  });

  assert.equal(filters.academicYear, '2026-2027');
  assert.equal(filters.semester, '2nd Semester');
});

test('2. parseReportFilters applies defaults when academic year or semester is missing or invalid', () => {
  const filters = parseReportFilters({
    academicYear: 'invalid-year-format-long-string-beyond-limit',
    semester: 'InvalidSemesterName',
  });

  assert.equal(filters.academicYear, getDefaultAcademicYear());
  assert.equal(filters.semester, getDefaultSemester());
});

test('3. parseReportFilters validates overallStatus and financialStatus allowlists', () => {
  const validFilters = parseReportFilters({
    overallStatus: 'approved',
    financialStatus: 'paid',
  });

  assert.equal(validFilters.overallStatus, 'approved');
  assert.equal(validFilters.financialStatus, 'paid');

  const invalidFilters = parseReportFilters({
    overallStatus: 'malicious_status_injection',
    financialStatus: 'invalid_financial_status',
  });

  assert.equal(invalidFilters.overallStatus, undefined);
  assert.equal(invalidFilters.financialStatus, undefined);
});

test('4. parseReportFilters trims strings, caps length at 50, and ignores "all"', () => {
  const filters = parseReportFilters({
    program: ' BSIT ',
    yearLevel: ' 1 ',
    section: 'all',
  });

  assert.equal(filters.program, 'BSIT');
  assert.equal(filters.yearLevel, '1');
  assert.equal(filters.section, undefined); // 'all' is converted to undefined

  const longString = 'a'.repeat(60);
  const overflowFilters = parseReportFilters({
    program: longString,
  });

  assert.equal(overflowFilters.program, undefined);
});
