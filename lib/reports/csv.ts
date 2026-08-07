import type { ReportSummary } from './types';

/**
 * Sanitizes a single CSV cell to prevent formula injection (=, +, -, @)
 * and properly escapes double quotes, commas, and line breaks.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Neutralize formula injection attack vectors (=, +, -, @)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes
  const escaped = str.replace(/"/g, '""');

  // Wrap in double quotes if string contains comma, quote, or newline
  if (/[",\n\r]/.test(str) || /^[=+\-@]/.test(String(value))) {
    return `"${escaped}"`;
  }

  return `"${escaped}"`;
}

/** Sanitize filename components to alphanumeric and hyphens. */
export function sanitizeFilenameComponent(val: string): string {
  return val.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

/** Generate standardized filename for CSV downloads. */
export function generateReportFilename(
  scope: 'admin' | 'dean',
  exportType: string,
  academicYear: string,
  semester: string
): string {
  const cleanYear = sanitizeFilenameComponent(academicYear);
  const cleanSem = sanitizeFilenameComponent(semester);
  const cleanType = sanitizeFilenameComponent(exportType);
  return `ascs-${scope}-${cleanType}-${cleanYear}-${cleanSem}.csv`;
}

/** Build metadata header rows. */
export function buildCsvMetadataHeader(summary: ReportSummary): string[] {
  return [
    `# ASCS Clearance ${summary.scope.toUpperCase()} Report`,
    `# Academic Year,${sanitizeCsvCell(summary.filters.academicYear)}`,
    `# Semester,${sanitizeCsvCell(summary.filters.semester)}`,
    `# Generated At,${sanitizeCsvCell(summary.generatedAt)}`,
    `# Report Scope,${sanitizeCsvCell(summary.scope)}`,
    '#',
  ];
}

/** Format summary metrics as CSV. */
export function generateSummaryCsv(summary: ReportSummary): string {
  const lines = [...buildCsvMetadataHeader(summary)];

  lines.push([
    sanitizeCsvCell('Metric Category'),
    sanitizeCsvCell('Total'),
    sanitizeCsvCell('Approved'),
    sanitizeCsvCell('Pending'),
    sanitizeCsvCell('Not Approved'),
    sanitizeCsvCell('Completion Rate (%)'),
  ].join(','));

  const app = summary.applicationSummary;
  const ratePct = `${(app.completionRate * 100).toFixed(1)}%`;
  lines.push([
    sanitizeCsvCell('Submitted Applications'),
    sanitizeCsvCell(app.total),
    sanitizeCsvCell(app.approved),
    sanitizeCsvCell(app.pending),
    sanitizeCsvCell(app.notApproved),
    sanitizeCsvCell(ratePct),
  ].join(','));

  if (summary.financialSummary && summary.scope === 'admin') {
    const fin = summary.financialSummary;
    lines.push([
      sanitizeCsvCell('Financial Status (Paid)'),
      sanitizeCsvCell(fin.paid),
      sanitizeCsvCell(fin.paid),
      sanitizeCsvCell(0),
      sanitizeCsvCell(0),
      sanitizeCsvCell('N/A'),
    ].join(','));
    lines.push([
      sanitizeCsvCell('Financial Status (Unpaid)'),
      sanitizeCsvCell(fin.unpaid),
      sanitizeCsvCell(0),
      sanitizeCsvCell(0),
      sanitizeCsvCell(fin.unpaid),
      sanitizeCsvCell('N/A'),
    ].join(','));
    lines.push([
      sanitizeCsvCell('Financial Status (Pending)'),
      sanitizeCsvCell(fin.pending),
      sanitizeCsvCell(0),
      sanitizeCsvCell(fin.pending),
      sanitizeCsvCell(0),
      sanitizeCsvCell('N/A'),
    ].join(','));
  }

  return '\uFEFF' + lines.join('\n');
}

/** Format requirement breakdown as CSV. */
export function generateRequirementBreakdownCsv(summary: ReportSummary): string {
  const lines = [...buildCsvMetadataHeader(summary)];

  lines.push([
    sanitizeCsvCell('Requirement Label'),
    sanitizeCsvCell('Role'),
    sanitizeCsvCell('Total Assigned'),
    sanitizeCsvCell('Approved'),
    sanitizeCsvCell('Pending'),
    sanitizeCsvCell('Not Approved'),
    sanitizeCsvCell('Unresolved Count'),
    sanitizeCsvCell('Completion Rate (%)'),
  ].join(','));

  for (const req of summary.requirementBreakdown) {
    const ratePct = `${(req.completionRate * 100).toFixed(1)}%`;
    lines.push([
      sanitizeCsvCell(req.label),
      sanitizeCsvCell(req.role),
      sanitizeCsvCell(req.totalAssigned),
      sanitizeCsvCell(req.approved),
      sanitizeCsvCell(req.pending),
      sanitizeCsvCell(req.notApproved),
      sanitizeCsvCell(req.unresolvedCount),
      sanitizeCsvCell(ratePct),
    ].join(','));
  }

  return '\uFEFF' + lines.join('\n');
}

/** Format program breakdown as CSV. */
export function generateProgramBreakdownCsv(summary: ReportSummary): string {
  const lines = [...buildCsvMetadataHeader(summary)];

  lines.push([
    sanitizeCsvCell('Program'),
    sanitizeCsvCell('Total Submitted'),
    sanitizeCsvCell('Approved'),
    sanitizeCsvCell('Pending'),
    sanitizeCsvCell('Not Approved'),
    sanitizeCsvCell('Completion Rate (%)'),
  ].join(','));

  for (const prog of summary.programBreakdown) {
    const ratePct = `${(prog.completionRate * 100).toFixed(1)}%`;
    lines.push([
      sanitizeCsvCell(prog.label),
      sanitizeCsvCell(prog.total),
      sanitizeCsvCell(prog.approved),
      sanitizeCsvCell(prog.pending),
      sanitizeCsvCell(prog.notApproved),
      sanitizeCsvCell(ratePct),
    ].join(','));
  }

  return '\uFEFF' + lines.join('\n');
}

export interface ApplicationDetailRow {
  studentNumber: string;
  studentName: string;
  program: string;
  yearLevel: string;
  section: string;
  academicYear: string;
  semester: string;
  overallStatus: string;
  financialStatus?: string;
  adviserApproved?: boolean;
  submittedAt?: string;
}

/** Format application detail rows as CSV with role-scoped privacy boundaries. */
export function generateApplicationDetailCsv(
  applications: ApplicationDetailRow[],
  summary: ReportSummary
): string {
  const lines = [...buildCsvMetadataHeader(summary)];

  if (summary.scope === 'admin') {
    lines.push([
      sanitizeCsvCell('Student Number'),
      sanitizeCsvCell('Student Name'),
      sanitizeCsvCell('Program'),
      sanitizeCsvCell('Year Level'),
      sanitizeCsvCell('Section'),
      sanitizeCsvCell('Academic Year'),
      sanitizeCsvCell('Semester'),
      sanitizeCsvCell('Overall Status'),
      sanitizeCsvCell('Financial Status'),
      sanitizeCsvCell('Submitted At'),
    ].join(','));

    for (const app of applications) {
      lines.push([
        sanitizeCsvCell(app.studentNumber),
        sanitizeCsvCell(app.studentName),
        sanitizeCsvCell(app.program),
        sanitizeCsvCell(app.yearLevel),
        sanitizeCsvCell(app.section),
        sanitizeCsvCell(app.academicYear),
        sanitizeCsvCell(app.semester),
        sanitizeCsvCell(app.overallStatus),
        sanitizeCsvCell(app.financialStatus || 'pending'),
        sanitizeCsvCell(app.submittedAt || ''),
      ].join(','));
    }
  } else {
    // Dean export: exclude Admin-only financial details and user management metadata
    lines.push([
      sanitizeCsvCell('Student Number'),
      sanitizeCsvCell('Student Name'),
      sanitizeCsvCell('Program'),
      sanitizeCsvCell('Year Level'),
      sanitizeCsvCell('Section'),
      sanitizeCsvCell('Academic Year'),
      sanitizeCsvCell('Semester'),
      sanitizeCsvCell('Overall Status'),
      sanitizeCsvCell('Adviser Approved'),
      sanitizeCsvCell('Submitted At'),
    ].join(','));

    for (const app of applications) {
      lines.push([
        sanitizeCsvCell(app.studentNumber),
        sanitizeCsvCell(app.studentName),
        sanitizeCsvCell(app.program),
        sanitizeCsvCell(app.yearLevel),
        sanitizeCsvCell(app.section),
        sanitizeCsvCell(app.academicYear),
        sanitizeCsvCell(app.semester),
        sanitizeCsvCell(app.overallStatus),
        sanitizeCsvCell(app.adviserApproved ? 'Yes' : 'No'),
        sanitizeCsvCell(app.submittedAt || ''),
      ].join(','));
    }
  }

  return '\uFEFF' + lines.join('\n');
}
