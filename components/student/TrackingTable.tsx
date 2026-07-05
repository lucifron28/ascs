'use client';

import React from 'react';
import { Calendar, UserCheck, MessageSquare, Clock } from 'lucide-react';

interface ApprovalRow {
  id: string;
  signatory_role: string;
  status: 'approved' | 'pending' | 'not_approved';
  acted_at: string | null;
  label: string;
  display_order: number;
  assignee_name: string | null;
}

interface Remark {
  id: string;
  approval_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface TrackingTableProps {
  approvals: ApprovalRow[];
  remarks: Remark[];
}

export default function TrackingTable({ approvals, remarks }: TrackingTableProps) {
  // Helper to format timestamps
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
      <div className="card bg-slate-900 border border-slate-800 shadow-2xl p-6 rounded-2xl">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" /> Signatory Checklist
        </h3>

        <div className="overflow-x-auto w-full">
          <table className="table w-full text-left text-sm border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-wider border-none">
                <th className="bg-transparent pb-4">Signatory Department</th>
                <th className="bg-transparent pb-4">Assigned Evaluator</th>
                <th className="bg-transparent pb-4">Clearance Status</th>
                <th className="bg-transparent pb-4">Last Actioned</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((appr) => {
                const approvalRemarks = remarks.filter((r) => r.approval_id === appr.id);

                return (
                  <React.Fragment key={appr.id}>
                    <tr className="bg-slate-950/40 hover:bg-slate-950/70 border border-slate-850 rounded-xl transition-all">
                      <td className="font-semibold text-white py-4 rounded-l-xl pl-4">
                        {appr.label}
                      </td>
                      <td className="text-slate-300 py-4">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                          <span>{appr.assignee_name || 'Department Desk'}</span>
                        </div>
                      </td>
                      <td className="py-4">{getStatusBadge(appr.status)}</td>
                      <td className="text-slate-400 py-4 rounded-r-xl pr-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-600" />
                          <span>{formatTime(appr.acted_at)}</span>
                        </div>
                      </td>
                    </tr>

                    {/* Remarks expansion row if there are any remarks for this approval */}
                    {approvalRemarks.length > 0 && (
                      <tr className="border-none">
                        <td colSpan={4} className="p-0 border-none">
                          <div className="bg-slate-950/20 border border-slate-850/50 rounded-xl mx-4 my-2 p-4 text-xs space-y-3">
                            <h4 className="font-semibold text-slate-400 flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Remarks Log
                            </h4>
                            {approvalRemarks.map((remark) => (
                              <div key={remark.id} className="border-l border-indigo-500/30 pl-3 py-1 space-y-1">
                                <p className="text-slate-300 italic">"{remark.content}"</p>
                                <div className="text-[10px] text-slate-500 flex gap-2">
                                  <span>By: {remark.author_name}</span>
                                  <span>•</span>
                                  <span>{formatTime(remark.created_at)}</span>
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
