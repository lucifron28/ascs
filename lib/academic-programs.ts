/**
 * PKM academic programs used by the fictional ASCS demonstration dataset.
 *
 * Firestore stores the compact program code. Display helpers derive the
 * human-readable name at the boundary so reports, UI, and print output stay
 * consistent without requiring a schema migration.
 */
export const ACADEMIC_PROGRAMS = {
  BSAIS: 'Accounting Information System',
  BSMA: 'Management Accounting',
  BEED: 'Bachelor of Elementary Education',
  ENGLISH: 'Bachelor of Arts in English',
  FILIPINO: 'Bachelor of Arts in Filipino',
  MATH: 'Bachelor of Science in Mathematics',
  SS: 'Bachelor of Arts in Social Studies',
  CRIM: 'Bachelor of Science in Criminology',
  ACP: 'Agriculture Crop Production',
  FSM: 'Food Service Management',
} as const;

export type AcademicProgramCode = keyof typeof ACADEMIC_PROGRAMS;

export const ACADEMIC_PROGRAM_CODES = Object.keys(ACADEMIC_PROGRAMS) as AcademicProgramCode[];

export const DEFAULT_ACADEMIC_PROGRAM_CODE: AcademicProgramCode = 'BSAIS';

/** Programs available when creating a new student account. */
export const ACTIVE_STUDENT_PROGRAM_CODES = ['BSAIS', 'BSMA'] as const satisfies readonly AcademicProgramCode[];

export type ActiveStudentProgramCode = (typeof ACTIVE_STUDENT_PROGRAM_CODES)[number];

export function isAcademicProgramCode(value: unknown): value is AcademicProgramCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACADEMIC_PROGRAMS, value);
}

export function isActiveStudentProgramCode(value: unknown): value is ActiveStudentProgramCode {
  return typeof value === 'string' && ACTIVE_STUDENT_PROGRAM_CODES.includes(value as ActiveStudentProgramCode);
}

/** Return the canonical display name, falling back safely for legacy/unknown values. */
export function getProgramName(code: string | null | undefined): string {
  const normalized = typeof code === 'string' ? code.trim() : '';
  return isAcademicProgramCode(normalized) ? ACADEMIC_PROGRAMS[normalized] : normalized || 'Unspecified';
}

/** Compact code-first label for tables, filters, and account details. */
export function formatProgram(code: string | null | undefined): string {
  const normalized = typeof code === 'string' ? code.trim() : '';
  if (!normalized) return 'Unspecified';
  return isAcademicProgramCode(normalized) ? `${normalized} — ${ACADEMIC_PROGRAMS[normalized]}` : normalized;
}

/** Name-first label for printable records and other document-like output. */
export function formatProgramNameFirst(code: string | null | undefined): string {
  const normalized = typeof code === 'string' ? code.trim() : '';
  if (!normalized) return 'Unspecified';
  return isAcademicProgramCode(normalized) ? `${ACADEMIC_PROGRAMS[normalized]} (${normalized})` : normalized;
}
