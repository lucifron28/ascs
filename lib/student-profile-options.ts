/** Canonical choices for newly created student profiles. */
export const STUDENT_YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;
export type StudentYearLevel = (typeof STUDENT_YEAR_LEVELS)[number];

export const STUDENT_PROFILE_SEMESTERS = ['1st Semester', '2nd Semester'] as const;
export type StudentProfileSemester = (typeof STUDENT_PROFILE_SEMESTERS)[number];

export function isStudentYearLevel(value: unknown): value is StudentYearLevel {
  return typeof value === 'string' && STUDENT_YEAR_LEVELS.includes(value as StudentYearLevel);
}

export function isStudentProfileSemester(value: unknown): value is StudentProfileSemester {
  return typeof value === 'string' && STUDENT_PROFILE_SEMESTERS.includes(value as StudentProfileSemester);
}
