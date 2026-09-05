import type { ClearanceStatus, FinancialStatus } from '@/lib/types/status';
import type { UserRole } from '@/lib/types/roles';

export type WorkflowStageKind = 'approval' | 'financial';

export const REQUIRED_SIGNATORY_ROLES = [
  'librarian',
  'osa_coordinator',
  'guidance_counselor',
  'area_chair',
  'dean',
] as const;

export type RequiredSignatoryRole = (typeof REQUIRED_SIGNATORY_ROLES)[number];

export interface ClearanceWorkflowStage {
  stage: number;
  key: RequiredSignatoryRole | 'accountant';
  role: UserRole;
  kind: WorkflowStageKind;
  label: string;
  responsibleTitle: string;
}

export const CLEARANCE_WORKFLOW_STAGES: readonly ClearanceWorkflowStage[] = [
  {
    stage: 1,
    key: 'librarian',
    role: 'librarian',
    kind: 'approval',
    label: 'Librarian Clearance',
    responsibleTitle: 'Librarian Officer',
  },
  {
    stage: 2,
    key: 'accountant',
    role: 'accountant',
    kind: 'financial',
    label: 'Accountant Clearance',
    responsibleTitle: 'Accountant',
  },
  {
    stage: 3,
    key: 'osa_coordinator',
    role: 'osa_coordinator',
    kind: 'approval',
    label: 'OSA Coordinator Clearance',
    responsibleTitle: 'OSA Coordinator',
  },
  {
    stage: 4,
    key: 'guidance_counselor',
    role: 'guidance_counselor',
    kind: 'approval',
    label: 'Guidance Counselor Clearance',
    responsibleTitle: 'Guidance Counselor',
  },
  {
    stage: 5,
    key: 'area_chair',
    role: 'area_chair',
    kind: 'approval',
    label: 'Area Chair Clearance',
    responsibleTitle: 'Area Chair',
  },
  {
    stage: 6,
    key: 'dean',
    role: 'dean',
    kind: 'approval',
    label: 'Dean Clearance',
    responsibleTitle: 'Dean of Business Program',
  },
] as const;

const REQUIRED_SIGNATORY_ROLE_SET = new Set<string>(REQUIRED_SIGNATORY_ROLES);

export interface WorkflowApproval {
  signatoryRole?: string | null;
  status?: ClearanceStatus | string | null;
}

export interface WorkflowState {
  approvals: readonly WorkflowApproval[];
  financialStatus: FinancialStatus | string | null | undefined;
}

export interface WorkflowProgress {
  completedStages: number;
  totalStages: number;
  currentStage: ClearanceWorkflowStage | null;
}

export function getWorkflowStageByKey(
  key: ClearanceWorkflowStage['key'],
): ClearanceWorkflowStage | undefined {
  return CLEARANCE_WORKFLOW_STAGES.find((stage) => stage.key === key);
}

export function getWorkflowStageForRole(role: string): ClearanceWorkflowStage | undefined {
  return CLEARANCE_WORKFLOW_STAGES.find((stage) => stage.role === role);
}

export function isRequiredSignatoryRole(role: string): role is RequiredSignatoryRole {
  return REQUIRED_SIGNATORY_ROLE_SET.has(role);
}

function approvalRowsForRole(state: WorkflowState, role: RequiredSignatoryRole): WorkflowApproval[] {
  return state.approvals.filter((approval) => approval.signatoryRole === role);
}

export function isWorkflowStagePassed(stage: ClearanceWorkflowStage, state: WorkflowState): boolean {
  if (stage.kind === 'financial') return state.financialStatus === 'paid';

  // `ClearanceWorkflowStage` keeps the stage key broad so consumers can
  // render all six stages. Once the financial stage is excluded, the
  // remaining keys are the five signatory roles used by approval rows.
  if (!isRequiredSignatoryRole(stage.key)) return false;
  const rows = approvalRowsForRole(state, stage.key);
  return rows.length > 0 && rows.every((approval) => approval.status === 'approved');
}

export function isWorkflowStageUnlocked(stage: ClearanceWorkflowStage, state: WorkflowState): boolean {
  const previousStages = CLEARANCE_WORKFLOW_STAGES.filter((candidate) => candidate.stage < stage.stage);
  return previousStages.every((previous) => isWorkflowStagePassed(previous, state)) && !isWorkflowStagePassed(stage, state);
}

export function getCurrentWorkflowStage(state: WorkflowState): ClearanceWorkflowStage | null {
  return CLEARANCE_WORKFLOW_STAGES.find((stage) => !isWorkflowStagePassed(stage, state)) || null;
}

export function getWorkflowProgress(state: WorkflowState): WorkflowProgress {
  let completedStages = 0;
  for (const stage of CLEARANCE_WORKFLOW_STAGES) {
    if (!isWorkflowStagePassed(stage, state)) break;
    completedStages += 1;
  }

  return {
    completedStages,
    totalStages: CLEARANCE_WORKFLOW_STAGES.length,
    currentStage: CLEARANCE_WORKFLOW_STAGES[completedStages] || null,
  };
}

export function canRoleActOnApplication(role: string, state: WorkflowState): boolean {
  const stage = getWorkflowStageForRole(role);
  return Boolean(stage && stage.kind === 'approval' && isWorkflowStageUnlocked(stage, state));
}

export function isFinancialStageActionable(state: WorkflowState): boolean {
  const stage = getWorkflowStageByKey('accountant');
  return Boolean(stage && isWorkflowStageUnlocked(stage, state) && (state.financialStatus === 'pending' || state.financialStatus === 'unpaid'));
}

export function getWorkflowStageStatus(stage: ClearanceWorkflowStage, state: WorkflowState): 'completed' | 'current' | 'locked' | 'failed' {
  const current = getCurrentWorkflowStage(state);
  // A later historical row may already be marked approved, but it must not
  // look complete while an earlier stage is still unresolved. The current
  // sequential position is the status users can act on.
  if (current && stage.stage > current.stage) return 'locked';
  if (isWorkflowStagePassed(stage, state)) return 'completed';
  if (current?.stage === stage.stage) {
    if (stage.kind === 'financial' && state.financialStatus === 'unpaid') return 'failed';
    if (stage.kind === 'approval' && state.approvals.some((approval) => approval.signatoryRole === stage.key && approval.status === 'not_approved')) {
      return 'failed';
    }
    return 'current';
  }
  return 'locked';
}
