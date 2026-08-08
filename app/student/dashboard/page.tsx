'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchStudentDashboardAction } from '@/app/actions/clearance';
import { normalizeSemester } from '@/lib/academic-term';
import ApplicationForm from '@/components/student/ApplicationForm';
import TrackingTable from '@/components/student/TrackingTable';
import StatusSummary from '@/components/student/StatusSummary';
import { Printer, CheckCircle2 } from 'lucide-react';
import RoleHeader from '@/components/layout/RoleHeader';
import AccessibleDialog from '@/components/ui/AccessibleDialog';

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
          <div className="alert alert-error bg-rose-950/80 border-rose-800 text-rose-300 rounded-xl flex items-center gap-2 p-3 text-sm">
            <span>Error: {error}</span>
            <button onClick={loadDashboard} className="btn btn-xs btn-outline border-rose-800 text-rose-300 rounded-lg ml-auto">
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
            <div className="card bg-base-100 border border-base-content/10 p-6 rounded-2xl max-w-xl mx-auto text-center space-y-3 shadow-sm">
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
              <div className="card bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-emerald-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Your clearance is approved. Print the ASCS prototype record for review.</span>
                </div>
                <button
                  onClick={handlePrint}
                  className="btn btn-sm btn-success bg-emerald-600 hover:bg-emerald-500 text-white border-none rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-950/30"
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
          title="ASCS Clearance Record Preview (Prototype)"
          description="A4 prototype record preview of clearance approvals and financial status."
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
                <h2 className="text-xl font-bold uppercase tracking-wide">Pambayang Kolehiyo ng Mauban</h2>
                <p className="text-xs italic text-slate-600">Mauban, Quezon</p>
                <p className="text-xs font-semibold mt-4 uppercase">Automated Student Clearance System (ASCS)</p>
                <p className="text-sm font-semibold uppercase">Student Clearance Certificate — Prototype / MVP</p>
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
                  <span className="font-bold">Program / Year:</span> {String((dashboardData?.application as Record<string, unknown> | undefined)?.program || '')} - {String((dashboardData?.application as Record<string, unknown> | undefined)?.yearLevel || '')}
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

              {/* Signatory grid */}
              <div className="grid grid-cols-2 gap-6 mt-10">
                {((dashboardData?.approvals as Array<{ id: string; assignee_name?: string; label?: string; acted_at?: string; signatory_role?: string }>) || [])
                  .filter((appr) => appr.signatory_role !== 'accountant')
                  .map((appr) => (
                  <div key={appr.id} className="border-b border-slate-200 pb-3 flex flex-col justify-end min-h-[60px] break-inside-avoid">
                    <div className="font-bold text-slate-800 text-xs">{appr.assignee_name || 'APPROVED'}</div>
                    <div className="text-[10px] text-slate-500 italic uppercase">{appr.label}</div>
                    <div className="text-[9px] text-emerald-600 font-semibold mt-1">Status: SIGNED ON {appr.acted_at ? new Date(appr.acted_at).toLocaleDateString() : new Date().toLocaleDateString()}</div>
                  </div>
                ))}
              </div>

              <div className="mt-16 text-center text-[10px] text-slate-400 italic">
                ASCS prototype output generated for internal testing on {new Date().toLocaleDateString()} — not an official school certificate.
              </div>
            </div>
          </div>
        </AccessibleDialog>
      </main>
    </div>
  );
}
