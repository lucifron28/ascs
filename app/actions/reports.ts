'use server';

import { getAdminFirestore } from '@/lib/firebase/admin';
import type { Query } from 'firebase-admin/firestore';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { parseReportFilters } from '@/lib/reports/filters';
import {
  calculateApplicationMetrics,
  calculateFinancialMetrics,
  calculateRequirementMetrics,
  calculateGroupMetrics,
  type RawApplicationData,
  type RawApprovalData,
} from '@/lib/reports/metrics';
import type { ReportFilters, ReportSummary, AdminReportExportType, DeanReportExportType } from '@/lib/reports/types';
import { mapLifecycleError, logSafeAuthError, sanitizeAuditMetadata } from '@/lib/admin/lifecycle-validation';
import {
  generateSummaryCsv,
  generateRequirementBreakdownCsv,
  generateProgramBreakdownCsv,
  generateApplicationDetailCsv,
  generateReportFilename,
  type ApplicationDetailRow,
} from '@/lib/reports/csv';

const MAX_REPORT_APPLICATIONS = 5000;

// Helper to authenticate Admin user
async function getAuthenticatedAdmin() {
  const authenticated = await getAuthenticatedUser();
  if (authenticated.user.role !== 'admin') {
    throw new Error('Unauthorized: Only system administrators can access Admin reports.');
  }
  return authenticated;
}

// Helper to authenticate Dean user
async function getAuthenticatedDean() {
  const authenticated = await getAuthenticatedUser();
  if (authenticated.user.role !== 'dean') {
    throw new Error('Unauthorized: Only the Academic Dean can access Dean clearance reports.');
  }
  return authenticated;
}

/** Fetch institution-wide clearance report summary for System Administrators. */
export async function fetchAdminReportSummaryAction(inputFilters: Partial<ReportFilters>) {
  let adminUid: string | undefined;
  try {
    const authenticated = await getAuthenticatedAdmin();
    adminUid = authenticated.uid;
    const filters = parseReportFilters(inputFilters);
    const firestore = getAdminFirestore();

    // 1. Build application query
    let query: Query = firestore
      .collection('clearanceApplications')
      .where('academicYear', '==', filters.academicYear)
      .where('semester', '==', filters.semester);

    if (filters.program) query = query.where('program', '==', filters.program);
    if (filters.yearLevel) query = query.where('yearLevel', '==', filters.yearLevel);
    if (filters.section) query = query.where('section', '==', filters.section);
    if (filters.overallStatus) query = query.where('overallStatus', '==', filters.overallStatus);
    if (filters.financialStatus) query = query.where('financialStatus', '==', filters.financialStatus);

    const appSnap = await query.limit(MAX_REPORT_APPLICATIONS).get();

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

    // 2. Fetch known active requirements
    const reqsSnap = await firestore.collection('clearanceRequirements').get().catch(() => null);
    const knownReqs = reqsSnap
      ? reqsSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            role: (d.role as string) || 'unknown',
            label: (d.label as string) || (d.role as string) || 'Requirement',
          };
        })
      : [];

    // 3. Fetch approvals for reporting applications
    const rawApprovals: RawApprovalData[] = [];
    if (appSnap.docs.length > 0 && appSnap.docs.length <= 500) {
      const approvalFetches = appSnap.docs.map((doc) => doc.ref.collection('approvals').get());
      const approvalSnaps = await Promise.all(approvalFetches);
      for (const snap of approvalSnaps) {
        for (const doc of snap.docs) {
          const d = doc.data();
          rawApprovals.push({
            requirementId: d.requirementId || doc.id,
            signatoryRole: d.signatoryRole,
            label: d.label,
            status: d.status,
          });
        }
      }
    }

    // 4. Calculate metrics
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
    logSafeAuthError('fetch_admin_report_summary', error, adminUid);
    return { success: false, error: mapLifecycleError(error, 'Failed to generate Admin clearance report.') };
  }
}

/** Fetch Dean academic clearance report summary (restricted to adviser-approved / Dean oversight scope). */
export async function fetchDeanReportSummaryAction(inputFilters: Partial<ReportFilters>) {
  let deanUid: string | undefined;
  try {
    const authenticated = await getAuthenticatedDean();
    deanUid = authenticated.uid;
    const filters = parseReportFilters(inputFilters);
    const firestore = getAdminFirestore();

    // 1. Build application query enforcing Dean oversight scope (adviserApproved === true)
    let query: Query = firestore
      .collection('clearanceApplications')
      .where('adviserApproved', '==', true)
      .where('academicYear', '==', filters.academicYear)
      .where('semester', '==', filters.semester);

    if (filters.program) query = query.where('program', '==', filters.program);
    if (filters.yearLevel) query = query.where('yearLevel', '==', filters.yearLevel);
    if (filters.section) query = query.where('section', '==', filters.section);
    if (filters.overallStatus) query = query.where('overallStatus', '==', filters.overallStatus);

    const appSnap = await query.limit(MAX_REPORT_APPLICATIONS).get();

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

    // 2. Fetch known requirements
    const reqsSnap = await firestore.collection('clearanceRequirements').get().catch(() => null);
    const knownReqs = reqsSnap
      ? reqsSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            role: (d.role as string) || 'unknown',
            label: (d.label as string) || (d.role as string) || 'Requirement',
          };
        })
      : [];

    // 3. Fetch approvals for reporting applications
    const rawApprovals: RawApprovalData[] = [];
    if (appSnap.docs.length > 0 && appSnap.docs.length <= 500) {
      const approvalFetches = appSnap.docs.map((doc) => doc.ref.collection('approvals').get());
      const approvalSnaps = await Promise.all(approvalFetches);
      for (const snap of approvalSnaps) {
        for (const doc of snap.docs) {
          const d = doc.data();
          rawApprovals.push({
            requirementId: d.requirementId || doc.id,
            signatoryRole: d.signatoryRole,
            label: d.label,
            status: d.status,
          });
        }
      }
    }

    // 4. Calculate Dean metrics
    const applicationSummary = calculateApplicationMetrics(rawApplications);
    const financialSummary = calculateFinancialMetrics(rawApplications);
    const requirementBreakdown = calculateRequirementMetrics(rawApprovals, knownReqs);
    const programBreakdown = calculateGroupMetrics(rawApplications, 'program');
    const yearLevelBreakdown = calculateGroupMetrics(rawApplications, 'yearLevel');
    const sectionBreakdown = calculateGroupMetrics(rawApplications, 'section');

    const summary: ReportSummary = {
      generatedAt: new Date().toISOString(),
      filters,
      scope: 'dean',
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
    logSafeAuthError('fetch_dean_report_summary', error, deanUid);
    return { success: false, error: mapLifecycleError(error, 'Failed to generate Dean clearance report.') };
  }
}

/** Fetch available distinct filter options (academic years, semesters, programs, year levels, sections). */
export async function fetchReportFilterOptionsAction() {
  let userUid: string | undefined;
  try {
    const authenticated = await getAuthenticatedUser();
    userUid = authenticated.uid;
    const firestore = getAdminFirestore();

    const [appsSnap, studentsSnap] = await Promise.all([
      firestore.collection('clearanceApplications').limit(200).get().catch(() => null),
      firestore.collection('students').limit(200).get().catch(() => null),
    ]);

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

    if (appsSnap) {
      appsSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.academicYear) academicYearsSet.add(String(d.academicYear));
        if (d.semester) semestersSet.add(String(d.semester));
        if (d.program) programsSet.add(String(d.program));
        if (d.yearLevel) yearLevelsSet.add(String(d.yearLevel));
        if (d.section) sectionsSet.add(String(d.section));
      });
    }

    if (studentsSnap) {
      studentsSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.program) programsSet.add(String(d.program));
        if (d.yearLevel) yearLevelsSet.add(String(d.yearLevel));
        if (d.section) sectionsSet.add(String(d.section));
      });
    }

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
    logSafeAuthError('fetch_report_filter_options', error, userUid);
    return { success: false, error: 'Failed to fetch report filter options.' };
  }
}

/** Export Admin report data as a safe UTF-8 CSV string with audit logging. */
export async function exportAdminReportCsvAction(
  inputFilters: Partial<ReportFilters>,
  exportType: AdminReportExportType = 'summary'
) {
  let adminUid: string | undefined;
  try {
    const { uid, user: adminUser } = await getAuthenticatedAdmin();
    adminUid = uid;
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

      const appSnap = await query.limit(MAX_REPORT_APPLICATIONS).get();
      const rows: ApplicationDetailRow[] = appSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          studentNumber: (d.studentNumber as string) || '',
          studentName: (d.studentName as string) || '',
          program: (d.program as string) || '',
          yearLevel: String(d.yearLevel || ''),
          section: (d.section as string) || '',
          academicYear: (d.academicYear as string) || '',
          semester: (d.semester as string) || '',
          overallStatus: (d.overallStatus as string) || 'pending',
          financialStatus: (d.financialStatus as string) || 'pending',
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
      actorName: adminUser.fullName || 'Administrator',
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
    logSafeAuthError('export_admin_report_csv', error, adminUid);
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
    const { uid, user: deanUser } = await getAuthenticatedDean();
    deanUid = uid;
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

      const appSnap = await query.limit(MAX_REPORT_APPLICATIONS).get();
      const rows: ApplicationDetailRow[] = appSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          studentNumber: (d.studentNumber as string) || '',
          studentName: (d.studentName as string) || '',
          program: (d.program as string) || '',
          yearLevel: String(d.yearLevel || ''),
          section: (d.section as string) || '',
          academicYear: (d.academicYear as string) || '',
          semester: (d.semester as string) || '',
          overallStatus: (d.overallStatus as string) || 'pending',
          adviserApproved: d.adviserApproved === true,
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
      actorName: deanUser.fullName || 'Academic Dean',
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
    logSafeAuthError('export_dean_report_csv', error, deanUid);
    return { success: false, error: mapLifecycleError(error, 'Failed to export Dean report CSV.') };
  }
}
