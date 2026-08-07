export interface ReportFilters {
  academicYear: string;
  semester: string;
  program?: string;
  yearLevel?: string;
  section?: string;
  overallStatus?: string;
  financialStatus?: string;
}

export interface ApplicationSummaryMetrics {
  total: number;
  approved: number;
  pending: number;
  notApproved: number;
  completionRate: number; // 0..1 numeric ratio
}

export interface FinancialSummaryMetrics {
  paid: number;
  unpaid: number;
  pending: number;
}

export interface RequirementMetric {
  requirementId: string;
  role: string;
  label: string;
  totalAssigned: number;
  approved: number;
  pending: number;
  notApproved: number;
  completionRate: number;
  unresolvedCount: number; // pending + notApproved
}

export interface GroupMetric {
  key: string;
  label: string;
  total: number;
  approved: number;
  pending: number;
  notApproved: number;
  completionRate: number;
}

export interface ReportSummary {
  generatedAt: string;
  filters: ReportFilters;
  scope: 'admin' | 'dean';
  applicationSummary: ApplicationSummaryMetrics;
  financialSummary?: FinancialSummaryMetrics;
  requirementBreakdown: RequirementMetric[];
  programBreakdown: GroupMetric[];
  yearLevelBreakdown: GroupMetric[];
  sectionBreakdown: GroupMetric[];
  highestUnresolvedRequirements: RequirementMetric[];
}

export type AdminReportExportType =
  | 'summary'
  | 'requirement-breakdown'
  | 'program-breakdown'
  | 'application-detail';

export type DeanReportExportType =
  | 'summary'
  | 'requirement-breakdown'
  | 'program-breakdown'
  | 'application-detail';
