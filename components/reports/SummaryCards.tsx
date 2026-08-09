import React from 'react';
import type { ReportSummary } from '@/lib/reports/types';
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Percent,
  CreditCard,
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
          <div className="flex items-center justify-between text-base-content/80">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Applications</span>
            <FileText className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-base-content">{app.total}</div>
          <p className="text-[10px] text-base-content/80 font-medium">Submitted applications in selected scope</p>
        </div>

        {/* Fully Approved */}
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-base-content/80">
            <span className="text-xs font-semibold uppercase tracking-wider">Fully Approved</span>
            <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-success">{app.approved}</div>
          <p className="text-[10px] text-base-content/80 font-medium">All required clearances approved</p>
        </div>

        {/* Pending Signatures */}
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-base-content/80">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-warning" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-warning">{app.pending}</div>
          <p className="text-[10px] text-base-content/80 font-medium">Awaiting signatory sign-off</p>
        </div>

        {/* Not Approved */}
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-base-content/80">
            <span className="text-xs font-semibold uppercase tracking-wider">Not Approved</span>
            <XCircle className="w-4 h-4 text-error" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-error">{app.notApproved}</div>
          <p className="text-[10px] text-base-content/80 font-medium">Holds or remarks present</p>
        </div>

        {/* Submitted Application Completion Rate */}
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-base-content/80">
            <span className="text-xs font-semibold uppercase tracking-wider">Completion Rate</span>
            <Percent className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-base-content">{ratePct}%</div>
          <div className="w-full bg-base-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(app.completionRate * 100, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-base-content/80 font-medium">Submitted Application Completion Rate</p>
        </div>
      </div>

      {/* Financial Status Summary (Admin / Dean Oversight) */}
      {summary.scope === 'admin' && fin && (
        <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" aria-hidden="true" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-base-content">
                Financial Verification Summary
              </h3>
            </div>
            <span className="text-[10px] text-base-content/80 font-medium">
              Accountant Financial Gate Audit
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-base-200/50 p-3 rounded-xl border border-base-content/10">
              <span className="text-[10px] text-base-content/80 font-semibold uppercase block">Paid / Cleared</span>
              <span className="text-xl font-bold text-success">{fin.paid}</span>
            </div>

            <div className="bg-base-200/50 p-3 rounded-xl border border-base-content/10">
              <span className="text-[10px] text-base-content/80 font-semibold uppercase block">Unpaid Dues / Holds</span>
              <span className="text-xl font-bold text-error">{fin.unpaid}</span>
            </div>

            <div className="bg-base-200/50 p-3 rounded-xl border border-base-content/10">
              <span className="text-[10px] text-base-content/80 font-semibold uppercase block">Pending Audit</span>
              <span className="text-xl font-bold text-warning">{fin.pending}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
