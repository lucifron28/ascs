import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEARANCE_WORKFLOW_STAGES,
  REQUIRED_SIGNATORY_ROLES,
  canRoleActOnApplication,
  getCurrentWorkflowStage,
  getWorkflowProgress,
  getWorkflowStageStatus,
  isFinancialStageActionable,
  isWorkflowStagePassed,
  type WorkflowState,
} from './workflow';

const approvedApprovals = (roles: readonly string[]) => roles.map((signatoryRole) => ({
  signatoryRole,
  status: 'approved' as const,
}));

test('workflow exposes six ordered stages with five signatory roles and one financial gate', () => {
  assert.deepEqual(
    CLEARANCE_WORKFLOW_STAGES.map((stage) => [stage.stage, stage.key, stage.kind]),
    [
      [1, 'librarian', 'approval'],
      [2, 'accountant', 'financial'],
      [3, 'osa_coordinator', 'approval'],
      [4, 'guidance_counselor', 'approval'],
      [5, 'area_chair', 'approval'],
      [6, 'dean', 'approval'],
    ],
  );
  assert.deepEqual(REQUIRED_SIGNATORY_ROLES, [
    'librarian',
    'osa_coordinator',
    'guidance_counselor',
    'area_chair',
    'dean',
  ]);
  assert.equal(CLEARANCE_WORKFLOW_STAGES.filter((stage) => stage.kind === 'financial').length, 1);
  assert.equal(CLEARANCE_WORKFLOW_STAGES.some((stage) => String(stage.key) === 'adviser'), false);
});

test('only the earliest unresolved stage is actionable', () => {
  const state: WorkflowState = { approvals: [], financialStatus: 'pending' };
  assert.equal(canRoleActOnApplication('librarian', state), true);
  assert.equal(canRoleActOnApplication('osa_coordinator', state), false);
  assert.equal(canRoleActOnApplication('dean', state), false);
  assert.equal(canRoleActOnApplication('adviser', state), false);
  assert.equal(isFinancialStageActionable(state), false);

  const afterLibrarian: WorkflowState = {
    approvals: [{ signatoryRole: 'librarian', status: 'approved' }],
    financialStatus: 'pending',
  };
  assert.equal(canRoleActOnApplication('librarian', afterLibrarian), false);
  assert.equal(isFinancialStageActionable(afterLibrarian), true);
  assert.equal(canRoleActOnApplication('osa_coordinator', afterLibrarian), false);

  const afterPaid: WorkflowState = { ...afterLibrarian, financialStatus: 'paid' };
  assert.equal(isFinancialStageActionable(afterPaid), false);
  assert.equal(canRoleActOnApplication('osa_coordinator', afterPaid), true);
});

test('later historical approvals do not bypass a blocked earlier stage', () => {
  const state: WorkflowState = {
    approvals: approvedApprovals(REQUIRED_SIGNATORY_ROLES),
    financialStatus: 'pending',
  };
  const progress = getWorkflowProgress(state);
  assert.equal(progress.completedStages, 1);
  assert.equal(progress.totalStages, 6);
  assert.equal(progress.currentStage?.key, 'accountant');
  assert.equal(isWorkflowStagePassed(CLEARANCE_WORKFLOW_STAGES[2], state), true);
  assert.equal(getWorkflowStageStatus(CLEARANCE_WORKFLOW_STAGES[2], state), 'locked');
  assert.equal(getWorkflowStageStatus(CLEARANCE_WORKFLOW_STAGES[1], state), 'current');
});

test('paid financial status and all five signatories complete the printable workflow', () => {
  const state: WorkflowState = {
    approvals: approvedApprovals(REQUIRED_SIGNATORY_ROLES),
    financialStatus: 'paid',
  };
  const progress = getWorkflowProgress(state);
  assert.equal(progress.completedStages, 6);
  assert.equal(progress.currentStage, null);
  assert.equal(CLEARANCE_WORKFLOW_STAGES.every((stage) => isWorkflowStagePassed(stage, state)), true);
});

test('unpaid and not-approved states stay failed and never unlock later offices', () => {
  const unpaid: WorkflowState = {
    approvals: [{ signatoryRole: 'librarian', status: 'approved' }],
    financialStatus: 'unpaid',
  };
  assert.equal(getWorkflowStageStatus(CLEARANCE_WORKFLOW_STAGES[1], unpaid), 'failed');
  assert.equal(canRoleActOnApplication('osa_coordinator', unpaid), false);

  const notApproved: WorkflowState = {
    approvals: [{ signatoryRole: 'librarian', status: 'not_approved' }],
    financialStatus: 'paid',
  };
  assert.equal(getWorkflowStageStatus(CLEARANCE_WORKFLOW_STAGES[0], notApproved), 'failed');
  assert.equal(canRoleActOnApplication('osa_coordinator', notApproved), false);
});

test('financial paid = completed and non-actionable', () => {
  const state: WorkflowState = {
    approvals: [{ signatoryRole: 'librarian', status: 'approved' }],
    financialStatus: 'paid',
  };
  assert.equal(isFinancialStageActionable(state), false);
  assert.equal(isWorkflowStagePassed(CLEARANCE_WORKFLOW_STAGES[1], state), true);
  assert.equal(getWorkflowStageStatus(CLEARANCE_WORKFLOW_STAGES[1], state), 'completed');
});

test('financial unpaid = current/failed but actionable for later settlement', () => {
  const state: WorkflowState = {
    approvals: [{ signatoryRole: 'librarian', status: 'approved' }],
    financialStatus: 'unpaid',
  };
  assert.equal(isFinancialStageActionable(state), true);
  assert.equal(getCurrentWorkflowStage(state)?.key, 'accountant');
  assert.equal(getWorkflowStageStatus(CLEARANCE_WORKFLOW_STAGES[1], state), 'failed');
});

test('post-state workflow returns no next stage when historical later approvals already complete the workflow', () => {
  const postState: WorkflowState = {
    approvals: approvedApprovals(REQUIRED_SIGNATORY_ROLES),
    financialStatus: 'paid',
  };
  assert.equal(getCurrentWorkflowStage(postState), null);
});

test('normal paid transition returns OSA as next stage', () => {
  const postState: WorkflowState = {
    approvals: [{ signatoryRole: 'librarian', status: 'approved' }],
    financialStatus: 'paid',
  };
  const nextStage = getCurrentWorkflowStage(postState);
  assert.equal(nextStage?.key, 'osa_coordinator');
  assert.equal(nextStage?.stage, 3);
});

test('normal signatory approval returns the correct next unresolved stage', () => {
  const postLibrarianState: WorkflowState = {
    approvals: [{ signatoryRole: 'librarian', status: 'approved' }],
    financialStatus: 'pending',
  };
  assert.equal(getCurrentWorkflowStage(postLibrarianState)?.key, 'accountant');

  const postOsaState: WorkflowState = {
    approvals: [
      { signatoryRole: 'librarian', status: 'approved' },
      { signatoryRole: 'osa_coordinator', status: 'approved' },
    ],
    financialStatus: 'paid',
  };
  assert.equal(getCurrentWorkflowStage(postOsaState)?.key, 'guidance_counselor');

  const postGuidanceState: WorkflowState = {
    approvals: [
      { signatoryRole: 'librarian', status: 'approved' },
      { signatoryRole: 'osa_coordinator', status: 'approved' },
      { signatoryRole: 'guidance_counselor', status: 'approved' },
    ],
    financialStatus: 'paid',
  };
  assert.equal(getCurrentWorkflowStage(postGuidanceState)?.key, 'area_chair');
});

test('final Dean approval returns no next stage', () => {
  const postDeanState: WorkflowState = {
    approvals: approvedApprovals(REQUIRED_SIGNATORY_ROLES),
    financialStatus: 'paid',
  };
  assert.equal(getCurrentWorkflowStage(postDeanState), null);
});
