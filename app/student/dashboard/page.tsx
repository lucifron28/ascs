'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { fetchStudentDashboardAction } from '@/app/actions/clearance';
import { normalizeSemester } from '@/lib/academic-term';
import ApplicationForm from '@/components/student/ApplicationForm';
import TrackingTable from '@/components/student/TrackingTable';
import StatusSummary from '@/components/student/StatusSummary';
import { Printer, CheckCircle2 } from 'lucide-react';
import RoleHeader from '@/components/layout/RoleHeader';
import AccessibleDialog from '@/components/ui/AccessibleDialog';
import { formatProgramNameFirst } from '@/lib/academic-programs';

const REQUIRED_SIGNATORY_ROLES = new Set([
  'librarian',
  'osa_coordinator',
  'guidance_counselor',
  'area_chair',
  'dean',
]);

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<{
    application: unknown;
    financial: unknown;
    approvals: Array<Record<string, unknown>>;
    remarks: Array<Record<string, unknown>>;
  } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Fetch student dashboard details
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStudentDashboardAction();
      if (res.success) {
        setDashboardData(res as unknown as {
          application: unknown;
          financial: unknown;
          approvals: Array<Record<string, unknown>>;
          remarks: Array<Record<string, unknown>>;
        });
      } else {
        if (res.error?.includes('Password change required')) {
          window.location.replace('/change-password');
          return;
        }
        setError(res.error || 'Failed to load dashboard data.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection error.';
      console.error('Fetch error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handlePrint = () => {
    const appObj = dashboardData?.application as { id?: string } | undefined;
    if (appObj?.id) {
      router.push(`/student/clearance/${appObj.id}/print`);
    } else {
      setShowPrintModal(true);
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-base-300 flex flex-col items-center justify-center text-base-content">
        <span className="loading loading-spinner loading-lg text-primary mb-2" aria-hidden="true" />
        <p className="text-base-content/70 text-sm font-medium animate-pulse">Loading clearance status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-300 text-base-content font-sans flex flex-col transition-colors duration-200">
      <RoleHeader roleTitle="Student Clearance" />

      {/* Main Container */}
      <main id="main-content" className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl w-full mx-auto space-y-8">
        {/* Error Alert panel */}
        {error && (
          <div role="alert" className="alert alert-error bg-error/10 border-error/30 text-error rounded-xl flex items-center gap-2 p-3 text-sm">
            <span>Error: {error}</span>
            <button onClick={loadDashboard} className="btn btn-sm min-h-11 btn-outline border-error text-error rounded-lg ml-auto">
              Retry
            </button>
          </div>
        )}

        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-base-content">
            Welcome Back!
          </h1>
          <p className="text-base-content/70 text-sm mt-1 font-medium">
            Check your clearance requirements checklist and accountability monitoring status.
          </p>
        </div>

        {/* Dashboard Content */}
        {dashboardData?.application === null ? (
          /* Application submission screen */
          <div className="space-y-6">
            <div className="card bg-base-100 border border-base-content/15 p-6 rounded-xl max-w-xl mx-auto text-center space-y-3 shadow-sm">
              <p className="text-sm text-base-content/70 font-medium">
                You do not have an active clearance application for the current semester. Complete the form below to initiate your checklist.
              </p>
            </div>
            <ApplicationForm onSuccess={loadDashboard} />
          </div>
        ) : (
          /* Status checklist tracking screen */
          <div className="space-y-8 animate-fade-in">
            {/* Overall Status Cards */}
            <StatusSummary
              application={dashboardData?.application as Parameters<typeof StatusSummary>[0]['application']}
              financial={dashboardData?.financial as Parameters<typeof StatusSummary>[0]['financial']}
            />

            {/* Print Action Bar */}
            {(dashboardData?.application as { overallStatus?: string } | undefined)?.overallStatus === 'approved' && (
              <div className="card bg-success/10 border border-success/30 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-base-content text-sm">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                  <span>Your clearance is approved. Print the ASCS prototype record for review.</span>
                </div>
                <button
                  onClick={handlePrint}
                  className="btn btn-sm min-h-11 btn-success rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print Clearance Record
                </button>
              </div>
            )}

            {/* Approvals Table */}
            <TrackingTable
              approvals={(dashboardData?.approvals as unknown) as Parameters<typeof TrackingTable>[0]['approvals']}
              remarks={(dashboardData?.remarks as unknown) as Parameters<typeof TrackingTable>[0]['remarks']}
            />
          </div>
        )}

        {/* Accessible Print Modal Dialog */}
        <AccessibleDialog
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          title="ASCS Student Clearance Record (Prototype)"
          description="A4 prototype record preview of five signatory decisions and the separate financial gate."
          maxWidthClass="max-w-3xl"
        >
          <div className="space-y-6">
            <div className="flex justify-end gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="btn btn-sm btn-primary rounded-xl flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Printer className="w-4 h-4" aria-hidden="true" />
                <span>Print Record</span>
              </button>
            </div>

            {/* Printable Content */}
            <div id="printable-clearance-area" className="bg-white text-slate-900 p-8 font-serif leading-relaxed text-sm rounded-xl border border-slate-200 shadow-sm">
              <div className="text-center space-y-1 mb-8">
                <Image
                  src="/pkmlogo.png"
                  alt="Pambayang Kolehiyo ng Mauban seal"
                  width={88}
                  height={88}
                  className="h-16 w-16 object-contain mx-auto mb-3"
                />
                <h2 className="text-xl font-bold uppercase tracking-wide">Pambayang Kolehiyo ng Mauban</h2>
                <p className="text-xs italic text-slate-600">Mauban, Quezon</p>
                <p className="text-xs font-semibold mt-4 uppercase">Automated Student Clearance System (ASCS)</p>
                <p className="text-sm font-black uppercase tracking-wide">STUDENT CLEARANCE RECORD</p>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-900">PROTOTYPE / MVP</p>
                <div className="w-32 h-0.5 bg-slate-800 mx-auto mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-6 mb-8 text-xs">
                <div>
                  <span className="font-bold">Student Name:</span> {String((dashboardData?.application as Record<string, unknown> | undefined)?.studentName || '')}
                </div>
                <div>
                  <span className="font-bold">Student ID No:</span> {String((dashboardData?.application as Record<string, unknown> | undefined)?.studentNumber || '')}
                </div>
                <div>
                  <span className="font-bold">Program / Year:</span> {formatProgramNameFirst(String((dashboardData?.application as Record<string, unknown> | undefined)?.program || ''))} - {String((dashboardData?.application as Record<string, unknown> | undefined)?.yearLevel || '')}
                </div>
                <div>
                  <span className="font-bold">Academic Term:</span> {String((dashboardData?.application as Record<string, unknown> | undefined)?.academicYear || '')} • {(dashboardData?.application as Record<string, unknown> | undefined)?.semester ? normalizeSemester((dashboardData?.application as Record<string, unknown>).semester) : ''}
                </div>
                <div>
                  <span className="font-bold">Purpose:</span> {String((dashboardData?.application as Record<string, unknown> | undefined)?.purpose || '')}
                </div>
                <div>
                  <span className="font-bold">Clearance Number:</span> {String((dashboardData?.application as Record<string, unknown> | undefined)?.applicationNumber || '')}
                </div>
              </div>

              <p className="mb-6 text-xs text-justify">
                This prototype record summarizes the approval and financial status recorded in ASCS for the specified academic term. It is not an official school certificate.
              </p>

              {/* Required signatory decisions */}
              <div className="mt-10">
                <h3 className="text-xs font-black uppercase tracking-wider border-b border-slate-300 pb-1">Required Signatory Clearance</h3>
                <div className="grid grid-cols-2 gap-6 mt-4">
                {((dashboardData?.approvals as Array<{ id: string; assignee_name?: string; label?: string; acted_at?: string; signatory_role?: string }>) || [])
                  .filter((appr) => REQUIRED_SIGNATORY_ROLES.has(appr.signatory_role || ''))
                  .map((appr) => (
                  <div key={appr.id} className="border-b border-slate-200 pb-3 flex flex-col justify-end min-h-[60px] break-inside-avoid">
                    <div className="font-bold text-slate-800 text-xs">{appr.label || 'Department desk'}</div>
                    <div className="text-[10px] text-slate-600">{appr.assignee_name || 'Department desk'}</div>
                    <div className="text-[9px] text-emerald-700 font-semibold mt-1">Decision recorded{appr.acted_at ? ` on ${new Date(appr.acted_at).toLocaleDateString()}` : ''}</div>
                  </div>
                ))}
                </div>
              </div>

              <div className="mt-8 border border-slate-200 bg-slate-50 p-4 text-xs">
                <h3 className="font-black uppercase tracking-wider text-slate-700">Financial Accountability Review</h3>
                <p className="mt-1 text-slate-600">The Accountant review is a separate financial gate and is not a signatory approval row.</p>
              </div>

              <div className="mt-8 text-center text-[10px] text-slate-700 font-bold uppercase tracking-wider border-t border-slate-300 pt-4">
                Prototype / MVP output for internal testing only — not an official school certificate, receipt, or electronic signature.
              </div>
            </div>
          </div>
        </AccessibleDialog>
      </main>
    </div>
  );
}
