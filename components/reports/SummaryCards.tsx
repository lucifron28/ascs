import React from 'react';
import type { ReportSummary } from '@/lib/reports/types';
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Percent,
  CreditCard,
  AlertCircle,
} from 'lucide-react';

interface SummaryCardsProps {
  summary: ReportSummary;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  const app = summary.applicationSummary;
  const fin = summary.financialSummary;
  const ratePct = (app.completionRate * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Primary Application Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Submitted Applications */}
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-base-content/60">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Applications</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-base-content">{app.total}</div>
          <p className="text-[10px] text-base-content/50">Submitted applications in selected scope</p>
        </div>

        {/* Fully Approved */}
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-base-content/60">
            <span className="text-xs font-semibold uppercase tracking-wider">Fully Approved</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-black text-success">{app.approved}</div>
          <p className="text-[10px] text-base-content/50">All required clearances approved</p>
        </div>

        {/* Pending Signatures */}
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-base-content/60">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-black text-warning">{app.pending}</div>
          <p className="text-[10px] text-base-content/50">Awaiting signatory sign-off</p>
        </div>

        {/* Not Approved */}
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-base-content/60">
            <span className="text-xs font-semibold uppercase tracking-wider">Not Approved</span>
            <XCircle className="w-4 h-4 text-error" />
          </div>
          <div className="text-2xl font-black text-error">{app.notApproved}</div>
          <p className="text-[10px] text-base-content/50">Holds or remarks present</p>
        </div>

        {/* Submitted Application Completion Rate */}
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-base-content/60">
            <span className="text-xs font-semibold uppercase tracking-wider">Completion Rate</span>
            <Percent className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-base-content">{ratePct}%</div>
          <div className="w-full bg-base-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(app.completionRate * 100, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-base-content/50">Submitted Application Completion Rate</p>
        </div>
      </div>

      {/* Financial Status Summary (Admin / Dean Oversight) */}
      {fin && (
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-base-content">
                Financial Verification Summary
              </h3>
            </div>
            <span className="text-[10px] text-base-content/50 font-medium">
              ASCS Financial Accountability Statuses
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div>
                <span className="font-medium text-emerald-400 block text-[11px]">Paid Records</span>
                <span className="text-lg font-black text-emerald-300">{fin.paid}</span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-80" />
            </div>

            <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <div>
                <span className="font-medium text-rose-400 block text-[11px]">Unpaid Holds</span>
                <span className="text-lg font-black text-rose-300">{fin.unpaid}</span>
              </div>
              <AlertCircle className="w-5 h-5 text-rose-400 opacity-80" />
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div>
                <span className="font-medium text-amber-400 block text-[11px]">Pending Verification</span>
                <span className="text-lg font-black text-amber-300">{fin.pending}</span>
              </div>
              <Clock className="w-5 h-5 text-amber-400 opacity-80" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
