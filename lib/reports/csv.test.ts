import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeCsvCell,
  sanitizeFilenameComponent,
  generateReportFilename,
  generateSummaryCsv,
  generateRequirementBreakdownCsv,
  generateProgramBreakdownCsv,
  generateApplicationDetailCsv,
} from './csv';
import type { ReportSummary } from './types';

test('1. sanitizeCsvCell neutralizes formula injection (=, +, -, @) with apostrophe', () => {
  assert.equal(sanitizeCsvCell('=SUM(A1:A10)'), '"\'=SUM(A1:A10)"');
  assert.equal(sanitizeCsvCell('+12345'), '"\'+12345"');
  assert.equal(sanitizeCsvCell('-12345'), '"\'-12345"');
  assert.equal(sanitizeCsvCell('@cmd'), '"\'@cmd"');
  assert.equal(sanitizeCsvCell('Normal Text'), '"Normal Text"');
});

test('2. sanitizeCsvCell escapes double quotes, commas, and line breaks', () => {
  assert.equal(sanitizeCsvCell('Hello "World"'), '"Hello ""World"""');
  assert.equal(sanitizeCsvCell('Cruz, Juan'), '"Cruz, Juan"');
  assert.equal(sanitizeCsvCell('Line1\nLine2'), '"Line1\nLine2"');
});

test('3. sanitizeFilenameComponent cleans strings to alphanumeric and hyphens', () => {
  assert.equal(sanitizeFilenameComponent('2026-2027'), '2026-2027');
  assert.equal(sanitizeFilenameComponent('1st Semester'), '1st-semester');
  assert.equal(sanitizeFilenameComponent('requirement breakdown!@#'), 'requirement-breakdown');
});

test('4. generateReportFilename produces predictable sanitized filenames', () => {
  const filename = generateReportFilename('admin', 'summary', '2026-2027', '1st Semester');
  assert.equal(filename, 'ascs-admin-summary-2026-2027-1st-semester.csv');
});

const mockSummary: ReportSummary = {
  generatedAt: '2026-08-07T00:00:00.000Z',
  filters: { academicYear: '2026-2027', semester: '1st Semester' },
  scope: 'admin',
  applicationSummary: { total: 10, approved: 6, pending: 3, notApproved: 1, completionRate: 0.6 },
  financialSummary: { paid: 7, unpaid: 2, pending: 1 },
  requirementBreakdown: [
    { requirementId: 'lib', role: 'librarian', label: 'Library Clearance', totalAssigned: 10, approved: 8, pending: 1, notApproved: 1, completionRate: 0.8, unresolvedCount: 2 },
  ],
  programBreakdown: [
    { key: 'BSAIS', label: 'BSAIS — Accounting Information System', total: 10, approved: 6, pending: 3, notApproved: 1, completionRate: 0.6 },
  ],
  yearLevelBreakdown: [],
  sectionBreakdown: [],
  highestUnresolvedRequirements: [],
};

test('5. generateSummaryCsv includes UTF-8 BOM, metadata header, and summary rows', () => {
  const csv = generateSummaryCsv(mockSummary);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  assert.match(csv, /# ASCS Clearance ADMIN Report/);
  assert.match(csv, /Submitted Applications/);
  assert.match(csv, /60\.0%/);
  assert.match(csv, /Financial Status \(Paid\)/);
});

test('6. Dean export excludes Admin-only financial details and user management metadata', () => {
  const mockDeanSummary: ReportSummary = {
    ...mockSummary,
    scope: 'dean',
    financialSummary: undefined,
  };

  const applications = [
    {
      studentNumber: 'STUD-001',
      studentName: 'Juan Cruz',
      program: 'BSAIS',
      yearLevel: '1',
      section: 'A',
      academicYear: '2026-2027',
      semester: '1st Semester',
      overallStatus: 'approved',
      financialStatus: 'paid',
      deanApproved: true,
      submittedAt: '2026-08-01',
    },
  ];

  const csv = generateApplicationDetailCsv(applications, mockDeanSummary);
  assert.match(csv, /# ASCS Clearance DEAN Report/);
  assert.match(csv, /"Dean Approved"/);
  assert.doesNotMatch(csv, /"Financial Status"/, 'Dean CSV should not contain Financial Status column header');
});
test('7. generateRequirementBreakdownCsv and generateProgramBreakdownCsv output valid CSV headers and rows', () => {
  const reqCsv = generateRequirementBreakdownCsv(mockSummary);
  assert.ok(reqCsv.startsWith('\uFEFF'));
  assert.match(reqCsv, /Library Clearance/);
  assert.match(reqCsv, /"Unresolved Count"/);

  const progCsv = generateProgramBreakdownCsv(mockSummary);
  assert.ok(progCsv.startsWith('\uFEFF'));
  assert.match(progCsv, /"BSAIS — Accounting Information System"/);
  assert.match(progCsv, /"Completion Rate \(%\)"/);
});
