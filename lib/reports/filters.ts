import type { ReportFilters } from './types';

export const VALID_SEMESTERS = [
  '1st',
  '2nd',
  'Summer',
  '1st Semester',
  '2nd Semester',
  'Summer Semester',
] as const;

export const VALID_OVERALL_STATUSES = ['pending', 'approved', 'not_approved'] as const;

export const VALID_FINANCIAL_STATUSES = ['pending', 'paid', 'unpaid'] as const;

/** Get default current academic year. */
export function getDefaultAcademicYear(): string {
  const year = new Date().getFullYear();
  return `${year}-${year + 1}`;
}

/** Get default current semester. */
export function getDefaultSemester(): string {
  return '1st Semester';
}

/**
 * Server-side parser & validator for report filters.
 * Rejects invalid types, sanitizes strings, enforces allowlists, and applies safe defaults.
 */
export function parseReportFilters(input: unknown): ReportFilters {
  const obj = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

  // Academic Year validation
  let academicYear = getDefaultAcademicYear();
  if (typeof obj.academicYear === 'string' && obj.academicYear.trim()) {
    const trimmed = obj.academicYear.trim();
    if (/^\d{4}-\d{4}$/.test(trimmed) || (trimmed.length <= 20 && !/[<>{}$]/.test(trimmed))) {
      academicYear = trimmed;
    }
  }

  // Semester validation
  let semester = getDefaultSemester();
  if (typeof obj.semester === 'string' && obj.semester.trim()) {
    const trimmed = obj.semester.trim();
    if (VALID_SEMESTERS.includes(trimmed as (typeof VALID_SEMESTERS)[number])) {
      semester = trimmed;
    }
  }

  const filters: ReportFilters = {
    academicYear,
    semester,
  };

  // Optional string filter sanitizer
  const sanitizeFilterString = (val: unknown): string | undefined => {
    if (typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    if (!trimmed || trimmed.length > 50 || /[<>{}$]/.test(trimmed)) return undefined;
    return trimmed;
  };

  const program = sanitizeFilterString(obj.program);
  if (program && program !== 'all') filters.program = program;

  const yearLevel = sanitizeFilterString(obj.yearLevel);
  if (yearLevel && yearLevel !== 'all') filters.yearLevel = yearLevel;

  const section = sanitizeFilterString(obj.section);
  if (section && section !== 'all') filters.section = section;

  if (typeof obj.overallStatus === 'string') {
    const status = obj.overallStatus.trim();
    if (VALID_OVERALL_STATUSES.includes(status as (typeof VALID_OVERALL_STATUSES)[number])) {
      filters.overallStatus = status;
    }
  }

  if (typeof obj.financialStatus === 'string') {
    const status = obj.financialStatus.trim();
    if (VALID_FINANCIAL_STATUSES.includes(status as (typeof VALID_FINANCIAL_STATUSES)[number])) {
      filters.financialStatus = status;
    }
  }

  return filters;
}
