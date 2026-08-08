export const CANONICAL_SEMESTERS = [
  '1st Semester',
  '2nd Semester',
  'Summer Semester',
] as const;

export type CanonicalSemester = (typeof CANONICAL_SEMESTERS)[number];

const SEMESTER_ALIASES: Record<string, CanonicalSemester> = {
  '1st': '1st Semester',
  '1st Semester': '1st Semester',
  '2nd': '2nd Semester',
  '2nd Semester': '2nd Semester',
  'Summer': 'Summer Semester',
  'Summer Semester': 'Summer Semester',
};

/**
 * Strict parser for semester values.
 * Maps valid canonical values and legacy aliases to CanonicalSemester.
 * Throws an Error for missing, non-string, empty, or unknown values.
 */
export function normalizeSemester(input: unknown): CanonicalSemester {
  if (typeof input !== 'string') {
    throw new Error('Semester must be a string.');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Semester cannot be empty.');
  }

  const canonical = SEMESTER_ALIASES[trimmed];
  if (!canonical) {
    throw new Error(
      `Invalid semester specified: '${input}'. Allowed values are: 1st, 1st Semester, 2nd, 2nd Semester, Summer, Summer Semester.`
    );
  }

  return canonical;
}

/**
 * Returns all Firestore storage aliases for a given canonical semester.
 * Canonical value is always first.
 */
export function getSemesterStorageAliases(input: unknown): string[] {
  const canonical = normalizeSemester(input);

  switch (canonical) {
    case '1st Semester':
      return ['1st Semester', '1st'];
    case '2nd Semester':
      return ['2nd Semester', '2nd'];
    case 'Summer Semester':
      return ['Summer Semester', 'Summer'];
  }
}

/**
 * Returns all possible document ID variations for a student's application in a given term.
 * Includes both canonical document ID and legacy short-form document ID.
 */
export function getApplicationTermDocumentIds(
  studentUid: string,
  academicYear: string,
  semesterInput: unknown
): string[] {
  const canonicalSem = normalizeSemester(semesterInput);
  const cleanYear = academicYear.trim().replace(/\s+/g, '-');

  let semDocAliases: string[];
  switch (canonicalSem) {
    case '1st Semester':
      semDocAliases = ['1st-Semester', '1st'];
      break;
    case '2nd Semester':
      semDocAliases = ['2nd-Semester', '2nd'];
      break;
    case 'Summer Semester':
      semDocAliases = ['Summer-Semester', 'Summer'];
      break;
  }

  return semDocAliases.map((semSlug) => `${studentUid}_${cleanYear}_${semSlug}`);
}
