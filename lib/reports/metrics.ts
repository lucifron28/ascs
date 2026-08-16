import type {
  ApplicationSummaryMetrics,
  FinancialSummaryMetrics,
  RequirementMetric,
  GroupMetric,
} from './types';
import {
  VALID_OVERALL_STATUSES,
  VALID_FINANCIAL_STATUSES,
} from './filters';
import { formatProgram } from '@/lib/academic-programs';

export const VALID_APPROVAL_STATUSES = ['pending', 'approved', 'not_approved'] as const;

/** Parse and validate overallStatus against allowlist. Throws a report data integrity error if invalid. */
export function parseApplicationStatus(status: unknown): 'pending' | 'approved' | 'not_approved' {
  const s = status || 'pending';
  if (!VALID_OVERALL_STATUSES.includes(s as (typeof VALID_OVERALL_STATUSES)[number])) {
    throw new Error(`Report data integrity error: Unknown application overallStatus '${String(status)}'.`);
  }
  return s as 'pending' | 'approved' | 'not_approved';
}

/** Parse and validate financialStatus against allowlist. Throws a report data integrity error if invalid. */
export function parseFinancialStatus(status: unknown): 'pending' | 'paid' | 'unpaid' {
  const s = status || 'pending';
  if (!VALID_FINANCIAL_STATUSES.includes(s as (typeof VALID_FINANCIAL_STATUSES)[number])) {
    throw new Error(`Report data integrity error: Unknown application financialStatus '${String(status)}'.`);
  }
  return s as 'pending' | 'paid' | 'unpaid';
}

/** Safe completion rate calculation (0..1 numeric ratio). Returns 0 when denominator is zero. */
export function calculateCompletionRate(approved: number, total: number): number {
  if (!total || total <= 0) return 0;
  const rate = approved / total;
  return Math.min(Math.max(rate, 0), 1);
}

export interface RawApplicationData {
  id: string;
  overallStatus?: string;
  financialStatus?: string;
  program?: string;
  yearLevel?: string | number;
  section?: string;
  deanApproved?: boolean;
  /** @deprecated Read-only compatibility for pre-migration report rows. */
  adviserApproved?: boolean;
}

export interface RawApprovalData {
  requirementId: string;
  signatoryRole?: string;
  label?: string;
  status?: string;
}

/**
 * Deduplicates applications by ID.
 * Throws a report data-integrity error if duplicate IDs contain contradictory reporting fields
 * (overallStatus, financialStatus, program, yearLevel, section, or deanApproved).
 */
export function deduplicateApplicationsById(
  applications: RawApplicationData[]
): RawApplicationData[] {
  const map = new Map<string, RawApplicationData>();

  for (const app of applications) {
    if (!app || !app.id) continue;
    const existing = map.get(app.id);
    if (existing) {
      const isContradictory =
        (existing.overallStatus || 'pending') !== (app.overallStatus || 'pending') ||
        (existing.financialStatus || 'pending') !== (app.financialStatus || 'pending') ||
        (existing.program || '').trim() !== (app.program || '').trim() ||
        String(existing.yearLevel || '').trim() !== String(app.yearLevel || '').trim() ||
        (existing.section || '').trim() !== (app.section || '').trim() ||
        Boolean(existing.deanApproved ?? existing.adviserApproved) !== Boolean(app.deanApproved ?? app.adviserApproved);

      if (isContradictory) {
        throw new Error(
          `Report data integrity error: Contradictory records found for duplicate application ID '${app.id}'.`
        );
      }
    } else {
      map.set(app.id, app);
    }
  }

  return Array.from(map.values());
}

/** Calculate summary metrics for submitted applications within scope. */
export function calculateApplicationMetrics(
  applications: RawApplicationData[]
): ApplicationSummaryMetrics {
  const deduplicated = deduplicateApplicationsById(applications);
  const total = deduplicated.length;
  let approved = 0;
  let pending = 0;
  let notApproved = 0;

  for (const app of deduplicated) {
    const status = parseApplicationStatus(app.overallStatus);
    if (status === 'approved') {
      approved++;
    } else if (status === 'not_approved') {
      notApproved++;
    } else {
      pending++;
    }
  }

  const completionRate = calculateCompletionRate(approved, total);

  return {
    total,
    approved,
    pending,
    notApproved,
    completionRate,
  };
}

/** Calculate summary metrics for financial status. */
export function calculateFinancialMetrics(
  applications: RawApplicationData[]
): FinancialSummaryMetrics {
  const deduplicated = deduplicateApplicationsById(applications);
  let paid = 0;
  let unpaid = 0;
  let pending = 0;

  for (const app of deduplicated) {
    const status = parseFinancialStatus(app.financialStatus);
    if (status === 'paid') {
      paid++;
    } else if (status === 'unpaid') {
      unpaid++;
    } else {
      pending++;
    }
  }

  return {
    paid,
    unpaid,
    pending,
  };
}

/** Calculate requirement metrics and bottleneck unresolved counts. */
export function calculateRequirementMetrics(
  approvals: RawApprovalData[],
  knownRequirements: Array<{ id: string; role: string; label: string }> = []
): RequirementMetric[] {
  const map = new Map<
    string,
    {
      requirementId: string;
      role: string;
      label: string;
      total: number;
      approved: number;
      pending: number;
      notApproved: number;
    }
  >();

  // Seed known active requirements (excluding accountant requirement role)
  for (const req of knownRequirements) {
    if (req.role === 'accountant') continue;
    map.set(req.id, {
      requirementId: req.id,
      role: req.role,
      label: req.label || req.role,
      total: 0,
      approved: 0,
      pending: 0,
      notApproved: 0,
    });
  }

  for (const approval of approvals) {
    if (approval.signatoryRole === 'accountant') continue;

    const reqId = approval.requirementId || approval.signatoryRole || 'unknown';
    const role = approval.signatoryRole || 'unknown';
    const label = approval.label || role;

    let item = map.get(reqId);
    if (!item) {
      item = {
        requirementId: reqId,
        role,
        label,
        total: 0,
        approved: 0,
        pending: 0,
        notApproved: 0,
      };
      map.set(reqId, item);
    }

    item.total++;
    const status = approval.status || 'pending';
    if (!VALID_APPROVAL_STATUSES.includes(status as (typeof VALID_APPROVAL_STATUSES)[number])) {
      throw new Error(`Report data integrity error: Unknown approval status '${status}'.`);
    }
    if (status === 'approved') {
      item.approved++;
    } else if (status === 'not_approved') {
      item.notApproved++;
    } else {
      item.pending++;
    }
  }

  const metrics: RequirementMetric[] = [];
  for (const item of map.values()) {
    const completionRate = calculateCompletionRate(item.approved, item.total);
    const unresolvedCount = item.pending + item.notApproved;

    metrics.push({
      requirementId: item.requirementId,
      role: item.role,
      label: item.label,
      totalAssigned: item.total,
      approved: item.approved,
      pending: item.pending,
      notApproved: item.notApproved,
      completionRate,
      unresolvedCount,
    });
  }

  return sortBottlenecks(metrics);
}

/** Sort requirement metrics deterministically by unresolvedCount desc, notApproved desc, pending desc, label asc. */
export function sortBottlenecks(metrics: RequirementMetric[]): RequirementMetric[] {
  return [...metrics].sort((a, b) => {
    if (b.unresolvedCount !== a.unresolvedCount) {
      return b.unresolvedCount - a.unresolvedCount;
    }
    if (b.notApproved !== a.notApproved) {
      return b.notApproved - a.notApproved;
    }
    if (b.pending !== a.pending) {
      return b.pending - a.pending;
    }
    return a.label.localeCompare(b.label);
  });
}

/** Group applications by a specified field (e.g. program, yearLevel, section). */
export function calculateGroupMetrics(
  applications: RawApplicationData[],
  field: 'program' | 'yearLevel' | 'section'
): GroupMetric[] {
  const deduplicated = deduplicateApplicationsById(applications);
  const map = new Map<
    string,
    {
      total: number;
      approved: number;
      pending: number;
      notApproved: number;
    }
  >();

  for (const app of deduplicated) {
    const rawVal = app[field];
    const key = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== ''
      ? String(rawVal).trim()
      : 'Unspecified';

    let item = map.get(key);
    if (!item) {
      item = { total: 0, approved: 0, pending: 0, notApproved: 0 };
      map.set(key, item);
    }

    item.total++;
    const status = parseApplicationStatus(app.overallStatus);
    if (status === 'approved') {
      item.approved++;
    } else if (status === 'not_approved') {
      item.notApproved++;
    } else {
      item.pending++;
    }
  }

  const result: GroupMetric[] = [];
  for (const [key, item] of map.entries()) {
    result.push({
      key,
      label: field === 'program' ? formatProgram(key) : key,
      total: item.total,
      approved: item.approved,
      pending: item.pending,
      notApproved: item.notApproved,
      completionRate: calculateCompletionRate(item.approved, item.total),
    });
  }

  return result.sort((a, b) => a.key.localeCompare(b.key));
}
