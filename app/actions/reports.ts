'use server';

import { getAdminFirestore } from '@/lib/firebase/admin';
import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { parseReportFilters } from '@/lib/reports/filters';
import {
  calculateApplicationMetrics,
  calculateFinancialMetrics,
  calculateRequirementMetrics,
  calculateGroupMetrics,
  parseApplicationStatus,
  parseFinancialStatus,
  type RawApplicationData,
  type RawApprovalData,
} from '@/lib/reports/metrics';
import type { ReportFilters, ReportSummary, AdminReportExportType, DeanReportExportType } from '@/lib/reports/types';
import { mapLifecycleError, logSafeAuthError, sanitizeAuditMetadata } from '@/lib/admin/lifecycle-validation';
import {
  assertReportScope,
  parseReportFilterScope,
  assertReportDatasetWithinLimit,
  MAX_REPORT_APPLICATIONS,
} from '@/lib/reports/authorization';
import {
  generateSummaryCsv,
  generateRequirementBreakdownCsv,
  generateProgramBreakdownCsv,
  generateApplicationDetailCsv,
  generateReportFilename,
  type ApplicationDetailRow,
} from '@/lib/reports/csv';

const APPROVAL_BATCH_SIZE = 25;

export const ADMIN_EXPORT_TYPES = [
  'summary',
  'requirement-breakdown',
  'program-breakdown',
  'application-detail',
] as const;

export const DEAN_EXPORT_TYPES = [
  'summary',
  'requirement-breakdown',
  'program-breakdown',
  'application-detail',
] as const;

/**
 * Fetches approval subcollections for a list of application documents in controlled parallel batches.
 */
async function fetchApprovalsInBatches(
  appDocs: QueryDocumentSnapshot[]
): Promise<RawApprovalData[]> {
  const rawApprovals: RawApprovalData[] = [];

  for (let i = 0; i < appDocs.length; i += APPROVAL_BATCH_SIZE) {
    const chunk = appDocs.slice(i, i + APPROVAL_BATCH_SIZE);
    const approvalFetches = chunk.map((doc) => doc.ref.collection('approvals').get());
    const approvalSnaps = await Promise.all(approvalFetches);

    for (const snap of approvalSnaps) {
      for (const doc of snap.docs) {
        const d = doc.data();
        rawApprovals.push({
          requirementId: (d.requirementId as string) || doc.id,
          signatoryRole: d.signatoryRole as string | undefined,
          label: d.label as string | undefined,
          status: d.status as string | undefined,
        });
      }
    }
  }

  return rawApprovals;
}

/** Fetch institution-wide clearance report summary for System Administrators. */
export async function fetchAdminReportSummaryAction(inputFilters: Partial<ReportFilters>) {
  let adminUid: string | undefined;
  try {
    const authenticated = await getAuthenticatedUser();
    adminUid = authenticated.uid;
    assertReportScope(authenticated.user, 'admin');

    const filters = parseReportFilters(inputFilters, 'admin');
    const firestore = getAdminFirestore();

    // 1. Build application query with MAX_REPORT_APPLICATIONS + 1 limit guard
    let query: Query = firestore
      .collection('clearanceApplications')
      .where('academicYear', '==', filters.academicYear)
      .where('semester', '==', filters.semester);

    if (filters.program) query = query.where('program', '==', filters.program);
    if (filters.yearLevel) query = query.where('yearLevel', '==', filters.yearLevel);
    if (filters.section) query = query.where('section', '==', filters.section);
    if (filters.overallStatus) query = query.where('overallStatus', '==', filters.overallStatus);
    if (filters.financialStatus) query = query.where('financialStatus', '==', filters.financialStatus);

    const appSnap = await query.limit(MAX_REPORT_APPLICATIONS + 1).get();
    assertReportDatasetWithinLimit(appSnap.docs.length, 'summary');

    const rawApplications: RawApplicationData[] = appSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        overallStatus: d.overallStatus,
        financialStatus: d.financialStatus,
        program: d.program,
        yearLevel: d.yearLevel,
        section: d.section,
        adviserApproved: d.adviserApproved,
      };
    });

    // 2. Fetch known active requirements (excluding accountant requirement role)
    const reqsSnap = await firestore.collection('clearanceRequirements').get().catch(() => null);
    const knownReqs = reqsSnap
      ? reqsSnap.docs
          .map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              role: (d.role as string) || 'unknown',
              label: (d.label as string) || (d.role as string) || 'Requirement',
              isActive: d.isActive ?? true,
            };
          })
          .filter((req) => req.role !== 'accountant' && req.isActive === true)
      : [];

    // 3. Fetch approvals in batched chunks for ALL scoped applications
    const rawApprovals = await fetchApprovalsInBatches(appSnap.docs);

    // 4. Calculate Admin metrics
    const applicationSummary = calculateApplicationMetrics(rawApplications);
    const financialSummary = calculateFinancialMetrics(rawApplications);
    const requirementBreakdown = calculateRequirementMetrics(rawApprovals, knownReqs);
    const programBreakdown = calculateGroupMetrics(rawApplications, 'program');
    const yearLevelBreakdown = calculateGroupMetrics(rawApplications, 'yearLevel');
    const sectionBreakdown = calculateGroupMetrics(rawApplications, 'section');

    const summary: ReportSummary = {
      generatedAt: new Date().toISOString(),
      filters,
      scope: 'admin',
      applicationSummary,
      financialSummary,
      requirementBreakdown,
      programBreakdown,
      yearLevelBreakdown,
      sectionBreakdown,
      highestUnresolvedRequirements: requirementBreakdown.slice(0, 5),
    };

    return { success: true, summary };
  } catch (error: unknown) {
    logSafeAuthError('fetch_admin_report_summary', error, { targetUid: adminUid });
    return { success: false, error: mapLifecycleError(error, 'Failed to generate Admin clearance report.') };
  }
}

/** Fetch Dean academic clearance report summary (restricted to adviser-approved / Dean oversight scope). */
export async function fetchDeanReportSummaryAction(inputFilters: Partial<ReportFilters>) {
  let deanUid: string | undefined;
  try {
    const authenticated = await getAuthenticatedUser();
    deanUid = authenticated.uid;
    assertReportScope(authenticated.user, 'dean');

    // Parse filters enforcing Dean scope (rejecting financialStatus)
    const filters = parseReportFilters(inputFilters, 'dean');
    const firestore = getAdminFirestore();

    // 1. Build application query enforcing Dean oversight scope (adviserApproved === true) with limit guard
    let query: Query = firestore
      .collection('clearanceApplications')
      .where('adviserApproved', '==', true)
      .where('academicYear', '==', filters.academicYear)
      .where('semester', '==', filters.semester);

    if (filters.program) query = query.where('program', '==', filters.program);
    if (filters.yearLevel) query = query.where('yearLevel', '==', filters.yearLevel);
    if (filters.section) query = query.where('section', '==', filters.section);
    if (filters.overallStatus) query = query.where('overallStatus', '==', filters.overallStatus);

    const appSnap = await query.limit(MAX_REPORT_APPLICATIONS + 1).get();
    assertReportDatasetWithinLimit(appSnap.docs.length, 'summary');

    const rawApplications: RawApplicationData[] = appSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        overallStatus: d.overallStatus,
        financialStatus: d.financialStatus,
        program: d.program,
        yearLevel: d.yearLevel,
        section: d.section,
        adviserApproved: d.adviserApproved,
      };
    });

    // 2. Fetch known active requirements (excluding accountant requirement role)
    const reqsSnap = await firestore.collection('clearanceRequirements').get().catch(() => null);
    const knownReqs = reqsSnap
      ? reqsSnap.docs
          .map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              role: (d.role as string) || 'unknown',
              label: (d.label as string) || (d.role as string) || 'Requirement',
              isActive: d.isActive ?? true,
            };
          })
          .filter((req) => req.role !== 'accountant' && req.isActive === true)
      : [];

    // 3. Fetch approvals in batched chunks for ALL Dean-visible applications
    const rawApprovals = await fetchApprovalsInBatches(appSnap.docs);

    // 4. Calculate Dean metrics (financialSummary is EXCLUDED from Dean report contract)
    const applicationSummary = calculateApplicationMetrics(rawApplications);
    const requirementBreakdown = calculateRequirementMetrics(rawApprovals, knownReqs);
    const programBreakdown = calculateGroupMetrics(rawApplications, 'program');
    const yearLevelBreakdown = calculateGroupMetrics(rawApplications, 'yearLevel');
    const sectionBreakdown = calculateGroupMetrics(rawApplications, 'section');

    const summary: ReportSummary = {
      generatedAt: new Date().toISOString(),
      filters,
      scope: 'dean',
      applicationSummary,
      financialSummary: undefined, // Omitted from Dean scope
      requirementBreakdown,
      programBreakdown,
      yearLevelBreakdown,
      sectionBreakdown,
      highestUnresolvedRequirements: requirementBreakdown.slice(0, 5),
    };

    return { success: true, summary };
  } catch (error: unknown) {
    logSafeAuthError('fetch_dean_report_summary', error, { targetUid: deanUid });
    return { success: false, error: mapLifecycleError(error, 'Failed to generate Dean clearance report.') };
  }
}

/** Fetch available distinct filter options authorized by role scope ('admin' | 'dean'). */
export async function fetchReportFilterOptionsAction(inputScope: unknown) {
  let userUid: string | undefined;
  try {
    const authenticated = await getAuthenticatedUser();
    userUid = authenticated.uid;

    const scope = parseReportFilterScope(inputScope);
    assertReportScope(authenticated.user, scope);

    const firestore = getAdminFirestore();
    const academicYearsSet = new Set<string>();
    const semestersSet = new Set<string>();
    const programsSet = new Set<string>();
    const yearLevelsSet = new Set<string>();
    const sectionsSet = new Set<string>();

    // Seed defaults
    const currentYear = new Date().getFullYear();
    academicYearsSet.add(`${currentYear}-${currentYear + 1}`);
    academicYearsSet.add(`${currentYear - 1}-${currentYear}`);
    semestersSet.add('1st Semester');
    semestersSet.add('2nd Semester');
    semestersSet.add('Summer Semester');

    // Build scope-aware application query
    let appsQuery: Query = firestore.collection('clearanceApplications');
    if (scope === 'dean') {
      appsQuery = appsQuery.where('adviserApproved', '==', true);
    }

    const appsSnap = await appsQuery.limit(MAX_REPORT_APPLICATIONS + 1).get();
    assertReportDatasetWithinLimit(appsSnap.docs.length, 'filter-options');

    appsSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (d.academicYear) academicYearsSet.add(String(d.academicYear));
      if (d.semester) semestersSet.add(String(d.semester));
      if (d.program) programsSet.add(String(d.program));
      if (d.yearLevel) yearLevelsSet.add(String(d.yearLevel));
      if (d.section) sectionsSet.add(String(d.section));
    });

    return {
      success: true,
      filterOptions: {
        academicYears: Array.from(academicYearsSet).sort().reverse(),
        semesters: Array.from(semestersSet).sort(),
        programs: Array.from(programsSet).sort(),
        yearLevels: Array.from(yearLevelsSet).sort(),
        sections: Array.from(sectionsSet).sort(),
      },
    };
  } catch (error: unknown) {
    logSafeAuthError('fetch_report_filter_options', error, { targetUid: userUid });
    return { success: false, error: mapLifecycleError(error, 'Failed to fetch report filter options.') };
  }
}

/** Export Admin report data as a safe UTF-8 CSV string with audit logging. */
export async function exportAdminReportCsvAction(
  inputFilters: Partial<ReportFilters>,
  exportType: AdminReportExportType = 'summary'
) {
  let adminUid: string | undefined;
  try {
    const authenticated = await getAuthenticatedUser();
    adminUid = authenticated.uid;
    assertReportScope(authenticated.user, 'admin');

    if (!ADMIN_EXPORT_TYPES.includes(exportType as (typeof ADMIN_EXPORT_TYPES)[number])) {
      throw new Error(`Invalid report export type specified: '${String(exportType)}'.`);
    }

    const summaryRes = await fetchAdminReportSummaryAction(inputFilters);

    if (!summaryRes.success || !summaryRes.summary) {
      throw new Error(summaryRes.error || 'Failed to fetch report summary for export.');
    }

    const summary = summaryRes.summary;
    const filters = summary.filters;
    const firestore = getAdminFirestore();
    let csvContent = '';
    let rowCount = 0;

    if (exportType === 'requirement-breakdown') {
      csvContent = generateRequirementBreakdownCsv(summary);
      rowCount = summary.requirementBreakdown.length;
    } else if (exportType === 'program-breakdown') {
      csvContent = generateProgramBreakdownCsv(summary);
      rowCount = summary.programBreakdown.length;
    } else if (exportType === 'application-detail') {
      let query: Query = firestore
        .collection('clearanceApplications')
        .where('academicYear', '==', filters.academicYear)
        .where('semester', '==', filters.semester);

      if (filters.program) query = query.where('program', '==', filters.program);
      if (filters.yearLevel) query = query.where('yearLevel', '==', filters.yearLevel);
      if (filters.section) query = query.where('section', '==', filters.section);
      if (filters.overallStatus) query = query.where('overallStatus', '==', filters.overallStatus);
      if (filters.financialStatus) query = query.where('financialStatus', '==', filters.financialStatus);

      const appSnap = await query.limit(MAX_REPORT_APPLICATIONS + 1).get();
      assertReportDatasetWithinLimit(appSnap.docs.length, 'export');

      const rows: ApplicationDetailRow[] = appSnap.docs.map((doc) => {
        const d = doc.data();
        const overallStatus = parseApplicationStatus(d.overallStatus);
        const financialStatus = parseFinancialStatus(d.financialStatus);

        return {
          studentNumber: (d.studentNumber as string) || '',
          studentName: (d.studentName as string) || '',
          program: (d.program as string) || '',
          yearLevel: String(d.yearLevel || ''),
          section: (d.section as string) || '',
          academicYear: (d.academicYear as string) || '',
          semester: (d.semester as string) || '',
          overallStatus,
          financialStatus,
          submittedAt: (d.submittedAt as string) || '',
        };
      });

      csvContent = generateApplicationDetailCsv(rows, summary);
      rowCount = rows.length;
    } else {
      csvContent = generateSummaryCsv(summary);
      rowCount = 1;
    }

    // Write Activity Log for CSV export
    const now = new Date().toISOString();
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
      actorId: adminUid,
      actorName: authenticated.user.fullName || 'Administrator',
      actorRole: 'admin',
      action: 'export_admin_report_csv',
      entityType: 'report',
      entityId: `${filters.academicYear}_${filters.semester}`,
      metadata: sanitizeAuditMetadata({
        exportType,
        academicYear: filters.academicYear,
        semester: filters.semester,
        rowCount,
      }),
      createdAt: now,
    });

    const filename = generateReportFilename('admin', exportType, filters.academicYear, filters.semester);

    return { success: true, csvContent, filename };
  } catch (error: unknown) {
    logSafeAuthError('export_admin_report_csv', error, { targetUid: adminUid });
    return { success: false, error: mapLifecycleError(error, 'Failed to export Admin report CSV.') };
  }
}

/** Export Dean academic clearance report data as a safe UTF-8 CSV string with audit logging. */
export async function exportDeanReportCsvAction(
  inputFilters: Partial<ReportFilters>,
  exportType: DeanReportExportType = 'summary'
) {
  let deanUid: string | undefined;
  try {
    const authenticated = await getAuthenticatedUser();
    deanUid = authenticated.uid;
    assertReportScope(authenticated.user, 'dean');

    if (!DEAN_EXPORT_TYPES.includes(exportType as (typeof DEAN_EXPORT_TYPES)[number])) {
      throw new Error(`Invalid report export type specified: '${String(exportType)}'.`);
    }

    const summaryRes = await fetchDeanReportSummaryAction(inputFilters);

    if (!summaryRes.success || !summaryRes.summary) {
      throw new Error(summaryRes.error || 'Failed to fetch Dean report summary for export.');
    }

    const summary = summaryRes.summary;
    const filters = summary.filters;
    const firestore = getAdminFirestore();
    let csvContent = '';
    let rowCount = 0;

    if (exportType === 'requirement-breakdown') {
      csvContent = generateRequirementBreakdownCsv(summary);
      rowCount = summary.requirementBreakdown.length;
    } else if (exportType === 'program-breakdown') {
      csvContent = generateProgramBreakdownCsv(summary);
      rowCount = summary.programBreakdown.length;
    } else if (exportType === 'application-detail') {
      let query: Query = firestore
        .collection('clearanceApplications')
        .where('adviserApproved', '==', true)
        .where('academicYear', '==', filters.academicYear)
        .where('semester', '==', filters.semester);

      if (filters.program) query = query.where('program', '==', filters.program);
      if (filters.yearLevel) query = query.where('yearLevel', '==', filters.yearLevel);
      if (filters.section) query = query.where('section', '==', filters.section);
      if (filters.overallStatus) query = query.where('overallStatus', '==', filters.overallStatus);

      const appSnap = await query.limit(MAX_REPORT_APPLICATIONS + 1).get();
      assertReportDatasetWithinLimit(appSnap.docs.length, 'export');

      const rows: ApplicationDetailRow[] = appSnap.docs.map((doc) => {
        const d = doc.data();
        const overallStatus = parseApplicationStatus(d.overallStatus);
        if (d.adviserApproved !== true) {
          throw new Error('Report data integrity error: Dean export encountered an application without adviser approval.');
        }

        return {
          studentNumber: (d.studentNumber as string) || '',
          studentName: (d.studentName as string) || '',
          program: (d.program as string) || '',
          yearLevel: String(d.yearLevel || ''),
          section: (d.section as string) || '',
          academicYear: (d.academicYear as string) || '',
          semester: (d.semester as string) || '',
          overallStatus,
          adviserApproved: true,
          submittedAt: (d.submittedAt as string) || '',
        };
      });

      csvContent = generateApplicationDetailCsv(rows, summary);
      rowCount = rows.length;
    } else {
      csvContent = generateSummaryCsv(summary);
      rowCount = 1;
    }

    // Write Activity Log for CSV export
    const now = new Date().toISOString();
    const logRef = firestore.collection('activityLogs').doc();
    await logRef.set({
      actorId: deanUid,
      actorName: authenticated.user.fullName || 'Academic Dean',
      actorRole: 'dean',
      action: 'export_dean_report_csv',
      entityType: 'report',
      entityId: `${filters.academicYear}_${filters.semester}`,
      metadata: sanitizeAuditMetadata({
        exportType,
        academicYear: filters.academicYear,
        semester: filters.semester,
        rowCount,
      }),
      createdAt: now,
    });

    const filename = generateReportFilename('dean', exportType, filters.academicYear, filters.semester);

    return { success: true, csvContent, filename };
  } catch (error: unknown) {
    logSafeAuthError('export_dean_report_csv', error, { targetUid: deanUid });
    return { success: false, error: mapLifecycleError(error, 'Failed to export Dean report CSV.') };
  }
}
