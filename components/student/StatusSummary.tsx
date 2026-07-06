'use client';

import React from 'react';
import { CreditCard, Check, AlertCircle, AlertTriangle } from 'lucide-react';

interface ApplicationSummary {
  application_number: string;
  overall_status: 'pending' | 'approved' | 'not_approved';
  submitted_at: string;
}

interface FinancialRecord {
  status: 'pending' | 'paid' | 'unpaid';
  notes: string | null;
  verified_at: string | null;
}

interface StatusSummaryProps {
  application: ApplicationSummary;
  financial: FinancialRecord | null;
}

export default function StatusSummary({ application, financial }: StatusSummaryProps) {
  // Overall Status Badge and description mapper
  const getOverallStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          title: 'Cleared',
          desc: 'Your application is fully approved. You can print your clearance.',
          cardBg: 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300',
          badgeBg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
          icon: <Check className="w-8 h-8 text-emerald-400" />,
        };
      case 'not_approved':
        return {
          title: 'Hold Clearance',
          desc: 'One or more departments found remarks. Please review and resolve.',
          cardBg: 'bg-rose-950/20 border-rose-800/40 text-rose-300',
          badgeBg: 'bg-rose-500/20 border-rose-500/30 text-rose-400',
          icon: <AlertCircle className="w-8 h-8 text-rose-400" />,
        };
      default:
        return {
          title: 'Under Review',
          desc: 'Your application is undergoing evaluation by clearance officers.',
          cardBg: 'bg-amber-950/20 border-amber-800/40 text-amber-300',
          badgeBg: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
          icon: <AlertTriangle className="w-8 h-8 text-amber-400" />,
        };
    }
  };

  // Financial Status Badge and description mapper
  const getFinancialStyle = (status: 'pending' | 'paid' | 'unpaid') => {
    switch (status) {
      case 'paid':
        return {
          title: 'Paid / Settled',
          desc: 'All financial records are clear. No accountability flags found.',
          cardBg: 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300',
          badgeBg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
        };
      case 'unpaid':
        return {
          title: 'Unpaid Balance',
          desc: financial?.notes || 'Account has unsettled dues. Clearance blocks remain active.',
          cardBg: 'bg-rose-950/20 border-rose-800/40 text-rose-300',
          badgeBg: 'bg-rose-500/20 border-rose-500/30 text-rose-400',
        };
      default: // pending
        return {
          title: 'Pending Verification',
          desc: 'Dues are currently being audited. The accountant has not yet signed off.',
          cardBg: 'bg-amber-950/20 border-amber-800/40 text-amber-300',
          badgeBg: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
        };
    }
  };

  const currentStyles = getOverallStyle(application.overall_status);
  const finStyles = getFinancialStyle(financial?.status || 'pending');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 1. Overall Status Card */}
      <div className={`card border shadow-2xl p-6 rounded-2xl flex flex-row items-start gap-4 transition-all ${currentStyles.cardBg}`}>
        <div className="avatar placeholder">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${currentStyles.badgeBg}`}>
            {currentStyles.icon}
          </div>
        </div>
        <div className="space-y-1 flex-1">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Overall Status</span>
          <h2 className="text-2xl font-black tracking-tight">{currentStyles.title}</h2>
          <p className="text-xs text-slate-300 leading-relaxed">{currentStyles.desc}</p>
          <div className="text-[10px] text-slate-500 mt-2">
            Ref: {application.application_number} • Submitted {new Date(application.submitted_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* 2. Financial Monitoring Card */}
      <div className={`card border shadow-2xl p-6 rounded-2xl flex flex-row items-start gap-4 transition-all ${finStyles.cardBg}`}>
        <div className="avatar placeholder">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${finStyles.badgeBg}`}>
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
        <div className="space-y-1 flex-1">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Financial Account</span>
          <h2 className="text-2xl font-black tracking-tight">{finStyles.title}</h2>
          <p className="text-xs text-slate-300 leading-relaxed">{finStyles.desc}</p>
          {financial?.verified_at && (
            <div className="text-[10px] text-slate-500 mt-2">
              Verified on {new Date(financial.verified_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
