interface StudentAcademicDetails {
  yearLevel?: string | null;
  program?: string | null;
  section?: string | null;
}

export function formatStudentAcademicSummary({ yearLevel, program, section }: StudentAcademicDetails): string {
  const year = yearLevel?.trim().replace(/\bYear\b/i, 'yr.');
  return [year, program?.trim(), section?.trim()].filter(Boolean).join(' - ');
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\byr\.?\b/g, 'year')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function matchesStudentSearch(query: string, ...values: Array<string | null | undefined>): boolean {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = normalizeSearchText(values.filter(Boolean).join(' '));
  return terms.every((term) => searchableText.includes(term));
}
