'use client';

import React from 'react';
import { Calendar, UserCheck, MessageSquare, Clock, LockKeyhole, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import {
  CLEARANCE_WORKFLOW_STAGES,
  getWorkflowStageStatus,
  type WorkflowState,
} from '@/lib/clearance/workflow';
import type { FinancialStatus } from '@/lib/types/status';

interface ApprovalRow {
  id: string;
  requirementId?: string;
  signatory_role: string;
  status: 'approved' | 'pending' | 'not_approved';
  acted_at: string | null;
  label: string;
  display_order: number;
  assignee_name: string | null;
}

interface Remark {
  id: string;
  approval_id?: string;
  approvalId?: string;
  author_name?: string;
  authorName?: string;
  content: string;
  created_at?: string;
  createdAt?: string;
}

interface WorkflowStageRow {
  stage: number;
  key: string;
  role: string;
  kind: 'approval' | 'financial';
  label: string;
  responsibleTitle: string;
  status: 'completed' | 'current' | 'locked' | 'failed';
  approvalStatus?: string | null;
  financialStatus?: string | null;
  assignedSignatoryName?: string | null;
  actedAt?: string | null;
  remarksLatest?: string | null;
}

interface TrackingTableProps {
  approvals: ApprovalRow[];
  remarks: Remark[];
  financialStatus?: FinancialStatus;
  financialVerifiedAt?: string | null;
  workflow?: {
    stages: WorkflowStageRow[];
    completedStages: number;
    totalStages: number;
    currentStage: string | null;
  };
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return '--';
  const date = new Date(timeStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(stage: WorkflowStageRow) {
  if (stage.status === 'completed') {
    return (
      <span className="badge border border-success/40 bg-success/10 text-success text-xs px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
        {stage.kind === 'financial' ? 'Paid / Cleared' : 'Approved'}
      </span>
    );
  }
  if (stage.status === 'failed') {
    return (
      <span className="badge border border-error/40 bg-error/10 text-error text-xs px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap">
        <AlertCircle className="w-3 h-3" aria-hidden="true" />
        {stage.kind === 'financial' ? 'Unpaid Dues' : 'Not Approved'}
      </span>
    );
  }
  if (stage.status === 'locked') {
    return (
      <span className="badge border border-base-content/20 bg-base-200 text-base-content/60 text-xs px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap">
        <LockKeyhole className="w-3 h-3" aria-hidden="true" /> Locked
      </span>
    );
  }
  return (
    <span className="badge border border-warning/40 bg-warning/10 text-warning text-xs px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap">
      {stage.kind === 'financial' ? 'Pending Financial Review' : 'Pending'}
    </span>
  );
}

export default function TrackingTable({
  approvals,
  remarks,
  financialStatus = 'pending',
  financialVerifiedAt = null,
  workflow,
}: TrackingTableProps) {
  const fallbackState: WorkflowState = {
    approvals: (approvals || []).map((approval) => ({
      signatoryRole: approval.signatory_role,
      status: approval.status,
    })),
    financialStatus,
  };
  const stages: WorkflowStageRow[] = workflow?.stages || CLEARANCE_WORKFLOW_STAGES.map((stage) => {
    const approval = approvals.find((item) => item.signatory_role === stage.role);
    return {
      stage: stage.stage,
      key: stage.key,
      role: stage.role,
      kind: stage.kind,
      label: stage.label,
      responsibleTitle: stage.responsibleTitle,
      status: getWorkflowStageStatus(stage, fallbackState),
      approvalStatus: stage.kind === 'approval' ? approval?.status || 'pending' : null,
      financialStatus: stage.kind === 'financial' ? financialStatus : null,
      assignedSignatoryName: approval?.assignee_name || null,
      actedAt: stage.kind === 'financial' ? financialVerifiedAt : approval?.acted_at || null,
      remarksLatest: approval
        ? remarks.find((remark) => remark.approval_id === approval.id || remark.approvalId === approval.id)?.content || null
        : null,
    };
  });

  const completedStages = workflow?.completedStages ?? stages.filter((stage) => stage.status === 'completed').length;
  const totalStages = workflow?.totalStages ?? CLEARANCE_WORKFLOW_STAGES.length;

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 border border-base-content/15 shadow-sm p-6 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
              <span>Clearance Workflow</span>
            </h3>
            <p className="text-xs text-base-content/70 mt-1">Six ordered stages: five signatory approvals and one financial gate.</p>
          </div>
          <span data-testid="workflow-progress" className="badge border border-primary/30 bg-primary/10 text-primary rounded-lg px-3 py-2 text-xs font-bold">
            {completedStages} of {totalStages} stages completed
          </span>
        </div>

        <p className="sm:hidden mb-3 text-xs text-base-content/60">Swipe horizontally to view all columns.</p>
        <div className="overflow-x-auto w-full">
          <table className="table w-full min-w-[760px] text-left text-sm border-separate border-spacing-y-2">
            <caption className="sr-only">Six-stage clearance workflow status</caption>
            <thead>
              <tr className="text-base-content/70 text-xs uppercase tracking-wider border-b border-base-content/10">
                <th scope="col" className="bg-transparent pb-4 pl-4 font-bold">Stage</th>
                <th scope="col" className="bg-transparent pb-4 font-bold">Responsible Office</th>
                <th scope="col" className="bg-transparent pb-4 font-bold">Status</th>
                <th scope="col" className="bg-transparent pb-4 font-bold">Assigned / Notes</th>
                <th scope="col" className="bg-transparent pb-4 pr-4 font-bold">Last Actioned</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => {
                const stageRemarks = stage.kind === 'approval'
                  ? remarks.filter((remark) => remark.approval_id === stage.key || remark.approvalId === stage.key)
                  : [];
                const lockedCopy = stage.status === 'locked' ? 'Waiting for previous clearance step.' : null;
                return (
                  <React.Fragment key={stage.key}>
                    <tr
                      data-testid={`workflow-stage-${stage.stage}`}
                      className={`border rounded-xl transition-all ${stage.status === 'locked' ? 'bg-base-200/30 border-base-content/10' : 'bg-base-200/50 hover:bg-base-200 border-base-content/10'}`}
                    >
                      <td className="font-semibold text-base-content py-4 rounded-l-xl pl-4">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-neutral badge-sm min-w-[3.75rem] shrink-0 justify-center whitespace-nowrap font-mono">Step {stage.stage}</span>
                          <span>{stage.label}</span>
                        </div>
                      </td>
                      <td className="text-base-content/80 py-4">
                        <div className="flex items-center gap-1.5">
                          {stage.kind === 'financial' ? <CreditCard className="w-3.5 h-3.5 text-base-content/50" aria-hidden="true" /> : <UserCheck className="w-3.5 h-3.5 text-base-content/50" aria-hidden="true" />}
                          <span>{stage.responsibleTitle}</span>
                        </div>
                      </td>
                      <td className="py-4">{getStatusBadge(stage)}</td>
                      <td className="text-base-content/80 py-4 text-xs">
                        {lockedCopy || stage.kind === 'financial'
                          ? lockedCopy || (stage.financialStatus === 'unpaid' ? 'Outstanding dues recorded.' : stage.financialStatus === 'paid' ? 'No outstanding balance recorded.' : 'Accountant review is pending.')
                          : stage.assignedSignatoryName || 'Department Desk'}
                      </td>
                      <td className="text-base-content/70 py-4 rounded-r-xl pr-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-base-content/50" aria-hidden="true" />
                          <span>{formatTime(stage.actedAt || null)}</span>
                        </div>
                      </td>
                    </tr>

                    {stageRemarks.length > 0 && (
                      <tr className="border-none">
                        <td colSpan={5} className="p-0 border-none">
                          <div className="bg-base-200 border border-base-content/10 rounded-xl mx-4 my-2 p-4 text-xs space-y-3">
                            <h4 className="font-semibold text-base-content/80 flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Remarks Log
                            </h4>
                            {stageRemarks.map((remark) => (
                              <div key={remark.id} className="border-l border-primary/30 pl-3 py-1 space-y-1">
                                <p className="text-base-content italic">&ldquo;{remark.content}&rdquo;</p>
                                <div className="text-[10px] text-base-content/60 flex gap-2">
                                  <span>By: {remark.author_name || remark.authorName || 'Signatory'}</span>
                                  <span>•</span>
                                  <span>{formatTime(remark.created_at || remark.createdAt || null)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
