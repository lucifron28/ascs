import type {
  ApplicationSummaryMetrics,
  FinancialSummaryMetrics,
  RequirementMetric,
  GroupMetric,
} from './types';

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
  adviserApproved?: boolean;
}

export interface RawApprovalData {
  requirementId: string;
  signatoryRole?: string;
  label?: string;
  status?: string;
}

/** Calculate summary metrics for submitted applications within scope. */
export function calculateApplicationMetrics(
  applications: RawApplicationData[]
): ApplicationSummaryMetrics {
  const total = applications.length;
  let approved = 0;
  let pending = 0;
  let notApproved = 0;

  for (const app of applications) {
    const status = app.overallStatus || 'pending';
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
  let paid = 0;
  let unpaid = 0;
  let pending = 0;

  for (const app of applications) {
    const status = app.financialStatus || 'pending';
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

  // Seed known requirements
  for (const req of knownRequirements) {
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
  const map = new Map<
    string,
    {
      total: number;
      approved: number;
      pending: number;
      notApproved: number;
    }
  >();

  for (const app of applications) {
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
    const status = app.overallStatus || 'pending';
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
      label: key,
      total: item.total,
      approved: item.approved,
      pending: item.pending,
      notApproved: item.notApproved,
      completionRate: calculateCompletionRate(item.approved, item.total),
    });
  }

  return result.sort((a, b) => a.key.localeCompare(b.key));
}
