'use client';

import React from 'react';
import { CreditCard, Check, AlertCircle, AlertTriangle } from 'lucide-react';

interface ApplicationSummary {
  applicationNumber: string;
  overallStatus: 'pending' | 'approved' | 'not_approved';
  submittedAt: string;
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
          title: 'Approved',
          desc: 'All configured signatories approved and financial status is Paid. You can print the prototype record.',
          cardBg: 'bg-success/10 border-success/30',
          badgeBg: 'bg-success/10 border-success/30 text-success',
          icon: <Check className="w-8 h-8 text-success" />,
        };
      case 'not_approved':
        return {
          title: 'Not Approved',
          desc: 'A signatory or the financial review marked this application as not approved. Review the remarks.',
          cardBg: 'bg-error/10 border-error/30',
          badgeBg: 'bg-error/10 border-error/30 text-error',
          icon: <AlertCircle className="w-8 h-8 text-error" />,
        };
      default:
        return {
          title: 'Pending',
          desc: 'Your application is undergoing evaluation by clearance officers.',
          cardBg: 'bg-warning/10 border-warning/30',
          badgeBg: 'bg-warning/10 border-warning/30 text-warning',
          icon: <AlertTriangle className="w-8 h-8 text-warning" />,
        };
    }
  };

  // Financial Status Badge and description mapper
  const getFinancialStyle = (status: 'pending' | 'paid' | 'unpaid') => {
    switch (status) {
      case 'paid':
        return {
          title: 'Paid / Settled',
          desc: 'Financial accountability is marked paid. No outstanding balance is recorded.',
          cardBg: 'bg-success/10 border-success/30',
          badgeBg: 'bg-success/10 border-success/30 text-success',
        };
      case 'unpaid':
        return {
          title: 'Unpaid Balance',
          desc: financial?.notes || 'Account has unsettled dues. Clearance blocks remain active.',
          cardBg: 'bg-error/10 border-error/30',
          badgeBg: 'bg-error/10 border-error/30 text-error',
        };
      default: // pending
        return {
          title: 'Pending Verification',
          desc: 'Dues are currently being audited. The accountant has not yet signed off.',
          cardBg: 'bg-warning/10 border-warning/30',
          badgeBg: 'bg-warning/10 border-warning/30 text-warning',
        };
    }
  };

  const currentStyles = getOverallStyle(application.overallStatus);
  const finStyles = getFinancialStyle(financial?.status || 'pending');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 1. Overall Status Card */}
      <div className={`card border shadow-sm p-6 rounded-xl flex flex-row items-start gap-4 transition-colors text-base-content ${currentStyles.cardBg}`}>
        <div className="avatar placeholder">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${currentStyles.badgeBg}`}>
            {currentStyles.icon}
          </div>
        </div>
        <div className="space-y-1 flex-1">
          <span className="text-base-content text-xs font-semibold uppercase tracking-wider">Overall Status</span>
          <h2 className="text-2xl font-black tracking-tight">{currentStyles.title}</h2>
          <p className="text-sm text-base-content/80 leading-relaxed">{currentStyles.desc}</p>
          <div className="text-[10px] text-base-content/80 font-semibold mt-2">
            Ref: {application.applicationNumber} • Submitted {new Date(application.submittedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* 2. Financial Monitoring Card */}
      <div className={`card border shadow-sm p-6 rounded-xl flex flex-row items-start gap-4 transition-colors text-base-content ${finStyles.cardBg}`}>
        <div className="avatar placeholder">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${finStyles.badgeBg}`}>
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
        <div className="space-y-1 flex-1">
          <span className="text-base-content text-xs font-semibold uppercase tracking-wider">Financial Status</span>
          <h2 className="text-2xl font-black tracking-tight">{finStyles.title}</h2>
          <p className="text-sm text-base-content/80 leading-relaxed">{finStyles.desc}</p>
          {financial?.verified_at && (
            <div className="text-[10px] text-base-content/80 font-semibold mt-2">
              Verified on {new Date(financial.verified_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
