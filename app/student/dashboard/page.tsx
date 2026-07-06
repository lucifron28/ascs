'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchStudentDashboardAction } from '@/app/actions/clearance';
import ApplicationForm from '@/components/student/ApplicationForm';
import TrackingTable from '@/components/student/TrackingTable';
import StatusSummary from '@/components/student/StatusSummary';
import { LogOut, Shield, Printer, RefreshCw, CheckCircle2, X } from 'lucide-react';

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Fetch student dashboard details
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStudentDashboardAction();
      if (res.success) {
        setDashboardData(res);
      } else {
        setError(res.error || 'Failed to load dashboard data.');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <span className="loading loading-spinner loading-lg text-indigo-500 mb-2" />
        <p className="text-slate-400 text-sm animate-pulse">Loading clearance status...</p>
      </div>
    );
  }

  return (
    <div data-theme="night" className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
      {/* Top Navigation Navbar */}
      <div className="navbar bg-slate-900/80 backdrop-blur border-b border-slate-800/60 px-6 shrink-0 z-30 sticky top-0">
        <div className="flex-1">
          <span className="font-extrabold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center gap-1.5">
            <Shield className="w-5 h-5 text-indigo-400 shrink-0" /> ASCS PKM
          </span>
        </div>
        <div className="flex-none flex items-center gap-2">
          <button
            onClick={loadDashboard}
            className="btn btn-sm btn-ghost hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg p-1.5"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="btn btn-sm btn-ghost hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl w-full mx-auto space-y-8">
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
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Welcome Back!
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Check your clearance requirements checklist and accountability monitoring status.
          </p>
        </div>

        {/* Dashboard Content */}
        {dashboardData?.application === null ? (
          /* Application submission screen */
          <div className="space-y-6">
            <div className="card bg-slate-900 border border-slate-800/40 p-6 rounded-2xl max-w-xl mx-auto text-center space-y-3">
              <p className="text-sm text-slate-400">
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
              application={dashboardData.application}
              financial={dashboardData.financial}
            />

            {/* Print Action Bar */}
            {dashboardData.application.overall_status === 'approved' && (
              <div className="card bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-emerald-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Congratulations! Your clearance is fully approved. Print your document now.</span>
                </div>
                <button
                  onClick={handlePrint}
                  className="btn btn-sm btn-success bg-emerald-600 hover:bg-emerald-500 text-white border-none rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-950/30"
                >
                  <Printer className="w-4 h-4" /> Print Clearance
                </button>
              </div>
            )}

            {/* Approvals Table */}
            <TrackingTable
              approvals={dashboardData.approvals}
              remarks={dashboardData.remarks}
            />
          </div>
        )}
      </div>

      {/* Printable Clearance Certificate Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-950 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <span className="font-bold text-slate-800">Clearance Document Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn btn-sm btn-primary bg-indigo-600 hover:bg-indigo-500 border-none text-white rounded-lg flex items-center gap-1"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="btn btn-sm btn-ghost hover:bg-slate-200 text-slate-500 rounded-lg p-1.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div id="printable-clearance-area" className="flex-1 overflow-y-auto p-8 font-serif leading-relaxed text-sm">
              <div className="text-center space-y-1 mb-8">
                <h2 className="text-xl font-bold uppercase tracking-wide">Pambayang Kolehiyo ng Mauban</h2>
                <p className="text-xs italic text-slate-600">Mauban, Quezon</p>
                <p className="text-sm font-semibold mt-4 uppercase">Certificate of Student Clearance</p>
                <div className="w-32 h-0.5 bg-slate-800 mx-auto mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-6 mb-8 text-xs">
                <div>
                  <span className="font-bold">Student Name:</span> Juan Dela Cruz
                </div>
                <div>
                  <span className="font-bold">Student ID No:</span> STUD-2026-0001
                </div>
                <div>
                  <span className="font-bold">Program / Year:</span> BSIT - 4th Year
                </div>
                <div>
                  <span className="font-bold">Academic Term:</span> {dashboardData?.application?.academic_year} • {dashboardData?.application?.semester} Semester
                </div>
                <div>
                  <span className="font-bold">Purpose:</span> {dashboardData?.application?.purpose}
                </div>
                <div>
                  <span className="font-bold">Clearance Number:</span> {dashboardData?.application?.application_number}
                </div>
              </div>

              <p className="mb-6 text-xs text-justify">
                This is to certify that the above-named student is completely cleared of all academic, property, and financial accountabilities to Pambayang Kolehiyo ng Mauban for the specified academic term.
              </p>

              {/* Signatory grid */}
              <div className="grid grid-cols-2 gap-6 mt-10">
                {dashboardData?.approvals.map((appr: any) => (
                  <div key={appr.id} className="border-b border-slate-200 pb-3 flex flex-col justify-end min-h-[60px]">
                    <div className="font-bold text-slate-800 text-xs">{appr.assignee_name || 'APPROVED'}</div>
                    <div className="text-[10px] text-slate-500 italic uppercase">{appr.label}</div>
                    <div className="text-[9px] text-emerald-600 font-semibold mt-1">Status: SIGNED ON {appr.acted_at ? new Date(appr.acted_at).toLocaleDateString() : new Date().toLocaleDateString()}</div>
                  </div>
                ))}
              </div>

              <div className="mt-16 text-center text-[10px] text-slate-400 italic">
                Generated automatically by PKM Automated Clearance System on {new Date().toLocaleDateString()}.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
