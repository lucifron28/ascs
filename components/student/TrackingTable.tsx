'use client';

import React from 'react';
import { Calendar, UserCheck, MessageSquare, Clock } from 'lucide-react';

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

interface TrackingTableProps {
  approvals: ApprovalRow[];
  remarks: Remark[];
}

export default function TrackingTable({ approvals, remarks }: TrackingTableProps) {
  // Filter out legacy Accountant approval rows (Accountant is represented in Financial Status section)
  const filteredApprovals = (approvals || []).filter(
    (app) => app.signatory_role !== 'accountant'
  );
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--';
    const d = new Date(timeStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper to map status classes
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="badge border border-emerald-800/60 bg-emerald-950/40 text-emerald-400 text-xs px-2.5 py-1 rounded-lg font-medium">
            Approved
          </span>
        );
      case 'not_approved':
        return (
          <span className="badge border border-rose-800/60 bg-rose-950/40 text-rose-400 text-xs px-2.5 py-1 rounded-lg font-medium">
            Not Approved
          </span>
        );
      default:
        return (
          <span className="badge border border-amber-800/60 bg-amber-950/40 text-amber-400 text-xs px-2.5 py-1 rounded-lg font-medium">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Approvals Checklist Card */}
      <div className="card bg-base-100 border border-base-content/10 shadow-xl p-6 rounded-2xl">
        <h3 className="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
          <span>Signatory Checklist</span>
        </h3>

        <div className="overflow-x-auto w-full">
          <table className="table w-full text-left text-sm border-separate border-spacing-y-2">
            <thead>
              <tr className="text-base-content/70 text-xs uppercase tracking-wider border-b border-base-content/10">
                <th scope="col" className="bg-transparent pb-4 pl-4 font-bold">Signatory Department</th>
                <th scope="col" className="bg-transparent pb-4 font-bold">Assigned Signatory</th>
                <th scope="col" className="bg-transparent pb-4 font-bold">Clearance Status</th>
                <th scope="col" className="bg-transparent pb-4 pr-4 font-bold">Last Actioned</th>
              </tr>
            </thead>
            <tbody>
              {filteredApprovals.map((appr) => {
                const approvalRemarks = remarks.filter(
                  (r) => r.approval_id === appr.id || r.approvalId === appr.id || r.approvalId === appr.requirementId
                );
                return (
                  <React.Fragment key={appr.id}>
                    <tr className="bg-base-200/50 hover:bg-base-200 border border-base-content/10 rounded-xl transition-all">
                      <td className="font-semibold text-base-content py-4 rounded-l-xl pl-4">
                        {appr.label}
                      </td>
                      <td className="text-base-content/80 py-4">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-base-content/50" aria-hidden="true" />
                          <span>{appr.assignee_name || 'Department Desk'}</span>
                        </div>
                      </td>
                      <td className="py-4">{getStatusBadge(appr.status)}</td>
                      <td className="text-base-content/70 py-4 rounded-r-xl pr-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-base-content/50" aria-hidden="true" />
                          <span>{formatTime(appr.acted_at)}</span>
                        </div>
                      </td>
                    </tr>

                    {/* Remarks expansion row if there are any remarks for this approval */}
                    {approvalRemarks.length > 0 && (
                      <tr className="border-none">
                        <td colSpan={4} className="p-0 border-none">
                          <div className="bg-base-200 border border-base-content/10 rounded-xl mx-4 my-2 p-4 text-xs space-y-3">
                            <h4 className="font-semibold text-base-content/80 flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Remarks Log
                            </h4>
                            {approvalRemarks.map((remark) => (
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
