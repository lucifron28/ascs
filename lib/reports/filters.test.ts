import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReportFilters,
  validateAcademicYear,
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

test('1b. parseReportFilters normalizes legacy semester aliases to canonical semester', () => {
  assert.equal(parseReportFilters({ semester: '1st' }).semester, '1st Semester');
  assert.equal(parseReportFilters({ semester: '1st Semester' }).semester, '1st Semester');
  assert.equal(parseReportFilters({ semester: '2nd' }).semester, '2nd Semester');
  assert.equal(parseReportFilters({ semester: '2nd Semester' }).semester, '2nd Semester');
  assert.equal(parseReportFilters({ semester: 'Summer' }).semester, 'Summer Semester');
  assert.equal(parseReportFilters({ semester: 'Summer Semester' }).semester, 'Summer Semester');
});

test('2. parseReportFilters applies defaults when academic year or semester is omitted', () => {
  const filters = parseReportFilters({});
  assert.equal(filters.academicYear, getDefaultAcademicYear());
  assert.equal(filters.semester, getDefaultSemester());
});

test('3. validateAcademicYear enforces YYYY-YYYY format and consecutive year sequence', () => {
  assert.equal(validateAcademicYear('2026-2027'), '2026-2027');
  assert.throws(() => validateAcademicYear('2026-2028'), /Second year .* must be exactly consecutive/);
  assert.throws(() => validateAcademicYear('abcd-2027'), /Invalid academic year format/);
  assert.throws(() => validateAcademicYear('2026'), /Invalid academic year format/);
});

test('4. parseReportFilters throws validation errors for invalid supplied values', () => {
  assert.throws(
    () => parseReportFilters({ semester: 'InvalidSemesterName' }),
    /Invalid semester specified/
  );
  assert.throws(
    () => parseReportFilters({ overallStatus: 'malicious_status_injection' }),
    /Invalid clearance status specified/
  );
  assert.throws(
    () => parseReportFilters({ financialStatus: 'invalid_financial_status' }),
    /Invalid financial status specified/
  );
  assert.throws(
    () => parseReportFilters({ program: 'a'.repeat(60) }),
    /exceeds maximum length/
  );
  assert.throws(
    () => parseReportFilters({ section: 'A<script>' }),
    /forbidden characters/
  );
});

test('5. Dean report scope rejects financialStatus filter', () => {
  assert.throws(
    () => parseReportFilters({ financialStatus: 'paid' }, 'dean'),
    /Financial status filter is not permitted for Dean reports/
  );
  assert.doesNotThrow(() => parseReportFilters({ financialStatus: 'paid' }, 'admin'));
});

test('6. parseReportFilters trims strings and handles "all" values', () => {
  const filters = parseReportFilters({
    program: ' BSAIS ',
    yearLevel: ' 1 ',
    section: 'all',
  });

  assert.equal(filters.program, 'BSAIS');
  assert.equal(filters.yearLevel, '1');
  assert.equal(filters.section, undefined);
});
