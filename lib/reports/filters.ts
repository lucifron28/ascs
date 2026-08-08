import { CANONICAL_SEMESTERS, normalizeSemester } from '@/lib/academic-term';
import type { ReportFilters } from './types';

export const VALID_SEMESTERS = CANONICAL_SEMESTERS;

export const VALID_OVERALL_STATUSES = ['pending', 'approved', 'not_approved'] as const;

export const VALID_FINANCIAL_STATUSES = ['pending', 'paid', 'unpaid'] as const;

/** Get default current academic year (e.g. "2026-2027"). */
export function getDefaultAcademicYear(): string {
  const year = new Date().getFullYear();
  return `${year}-${year + 1}`;
}

/** Get default current semester. */
export function getDefaultSemester(): string {
  return '1st Semester';
}

/**
 * Validates academic year string. Must match YYYY-YYYY format where second year is first year + 1.
 */
export function validateAcademicYear(academicYear: unknown): string {
  if (typeof academicYear !== 'string') {
    throw new Error('Academic year must be a string.');
  }
  const trimmed = academicYear.trim();
  if (!/^\d{4}-\d{4}$/.test(trimmed)) {
    throw new Error(`Invalid academic year format: '${academicYear}'. Expected format is YYYY-YYYY (e.g., 2026-2027).`);
  }

  const [y1, y2] = trimmed.split('-').map(Number);
  if (y2 !== y1 + 1) {
    throw new Error(`Invalid academic year sequence: '${academicYear}'. Second year (${y2}) must be exactly consecutive to first year (${y1}).`);
  }

  return trimmed;
}

/**
 * Server-side parser & strict validator for report filters.
 * Applies defaults when fields are omitted, but THROWS validation errors when invalid values are supplied.
 */
export function parseReportFilters(
  input: unknown,
  scope: 'admin' | 'dean' = 'admin'
): ReportFilters {
  if (input !== undefined && input !== null && (typeof input !== 'object' || Array.isArray(input))) {
    throw new Error('Invalid report filters input: expected a filter object.');
  }

  const obj = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

  // 1. Academic Year
  let academicYear = getDefaultAcademicYear();
  if (obj.academicYear !== undefined && obj.academicYear !== null && String(obj.academicYear).trim() !== '') {
    academicYear = validateAcademicYear(obj.academicYear);
  }

  // 2. Semester
  let semester = getDefaultSemester();
  if (obj.semester !== undefined && obj.semester !== null && String(obj.semester).trim() !== '') {
    semester = normalizeSemester(obj.semester);
  }

  const filters: ReportFilters = {
    academicYear,
    semester,
  };

  // Helper for optional string filter fields
  const validateOptionalString = (val: unknown, fieldName: string): string | undefined => {
    if (val === undefined || val === null || val === '' || val === 'all') return undefined;
    if (typeof val !== 'string' && typeof val !== 'number') {
      throw new Error(`Invalid ${fieldName} filter: expected string or number.`);
    }
    const str = String(val).trim();
    if (!str || str === 'all') return undefined;
    if (str.length > 50) {
      throw new Error(`Invalid ${fieldName} filter: value exceeds maximum length of 50 characters.`);
    }
    if (/[<>{}$]/.test(str)) {
      throw new Error(`Invalid ${fieldName} filter: value contains forbidden characters.`);
    }
    return str;
  };

  const program = validateOptionalString(obj.program, 'program');
  if (program) filters.program = program;

  const yearLevel = validateOptionalString(obj.yearLevel, 'yearLevel');
  if (yearLevel) filters.yearLevel = yearLevel;

  const section = validateOptionalString(obj.section, 'section');
  if (section) filters.section = section;

  // Overall Status
  if (obj.overallStatus !== undefined && obj.overallStatus !== null && obj.overallStatus !== '' && obj.overallStatus !== 'all') {
    if (typeof obj.overallStatus !== 'string') {
      throw new Error('Clearance status filter must be a string.');
    }
    const status = obj.overallStatus.trim();
    if (!VALID_OVERALL_STATUSES.includes(status as (typeof VALID_OVERALL_STATUSES)[number])) {
      throw new Error(`Invalid clearance status specified: '${obj.overallStatus}'. Allowed values are: ${VALID_OVERALL_STATUSES.join(', ')}.`);
    }
    filters.overallStatus = status;
  }

  // Financial Status
  if (obj.financialStatus !== undefined && obj.financialStatus !== null && obj.financialStatus !== '' && obj.financialStatus !== 'all') {
    if (scope === 'dean') {
      throw new Error('Financial status filter is not permitted for Dean reports.');
    }
    if (typeof obj.financialStatus !== 'string') {
      throw new Error('Financial status filter must be a string.');
    }
    const status = obj.financialStatus.trim();
    if (!VALID_FINANCIAL_STATUSES.includes(status as (typeof VALID_FINANCIAL_STATUSES)[number])) {
      throw new Error(`Invalid financial status specified: '${obj.financialStatus}'. Allowed values are: ${VALID_FINANCIAL_STATUSES.join(', ')}.`);
    }
    filters.financialStatus = status;
  }

  return filters;
}
