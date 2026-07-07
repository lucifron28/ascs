'use client';

import React, { useState, useEffect } from 'react';
import { fetchDeanApplicationsAction } from '@/app/actions/clearance';
import { ClipboardList, ShieldAlert, CheckCircle2, Search, CircleEllipsis, X } from 'lucide-react';

interface DeanApplication {
  id: string;
  applicationNumber: string;
  studentNumber: string;
  studentName: string;
  program: string;
  yearLevel: string;
  section: string;
  academicYear: string;
  semester: string;
  purpose: string;
  overallStatus: 'pending' | 'approved' | 'not_approved';
  financialStatus: 'pending' | 'paid' | 'unpaid';
  submittedAt: string;
  updatedAt: string;
}

export default function DeanDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<DeanApplication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<DeanApplication | null>(null);

  const isMounted = React.useRef(true);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDeanApplicationsAction();
      if (isMounted.current) {
        if (res.success) {
          setRecords(res.deanQueue || []);
        } else {
          setError(res.error || 'Failed to retrieve academic clearance queue.');
        }
      }
    } catch (err: any) {
      console.error('Error loading Dean records:', err);
      if (isMounted.current) {
        setError(err.message || 'Connection error.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    loadRecords();
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Filtered List
  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      rec.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.applicationNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || rec.overallStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const clearedCount = records.filter((r) => r.overallStatus === 'approved').length;
  const pendingCount = records.filter((r) => r.overallStatus === 'pending').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white">
        <span className="loading loading-spinner loading-lg text-indigo-500 mb-2" />
        <p className="text-slate-400 text-sm animate-pulse">Loading academic queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Adviser Approved</span>
            <h3 className="text-2xl font-black text-white">{records.length}</h3>
          </div>
        </div>

        <div className="card bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Fully Cleared</span>
            <h3 className="text-2xl font-black text-white">{clearedCount}</h3>
          </div>
        </div>

        <div className="card bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-950 border border-amber-800/40 flex items-center justify-center text-amber-400">
            <CircleEllipsis className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">In Evaluation</span>
            <h3 className="text-2xl font-black text-white">{pendingCount}</h3>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error bg-rose-950/80 border-rose-800 text-rose-300 rounded-xl flex items-center gap-2 p-3 text-sm">
          <span>Error: {error}</span>
          <button onClick={loadRecords} className="btn btn-xs btn-outline border-rose-800 text-rose-300 rounded-lg ml-auto">
            Retry
          </button>
        </div>
      )}

      {/* 2. Filters & Actions Bar */}
      <div className="card bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4 justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by student name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-bordered w-full pl-9 bg-slate-950/50 border-slate-800 focus:border-indigo-500 text-white rounded-xl placeholder-slate-600 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
          <button
            onClick={() => setStatusFilter('all')}
            className={`btn btn-xs rounded-lg px-3 h-8 text-[11px] font-semibold border-none ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`btn btn-xs rounded-lg px-3 h-8 text-[11px] font-semibold border-none ${
              statusFilter === 'pending'
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`btn btn-xs rounded-lg px-3 h-8 text-[11px] font-semibold border-none ${
              statusFilter === 'approved'
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Cleared
          </button>
        </div>
      </div>

      {/* 3. Academic Queue List */}
      {filteredRecords.length === 0 ? (
        <div className="card bg-slate-900 border border-slate-800/40 p-12 rounded-2xl text-center space-y-2">
          <CircleEllipsis className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-slate-400 font-bold text-sm">No Student Records Found</h3>
          <p className="text-slate-600 text-xs">Only applications cleared by academic advisers are visible here.</p>
        </div>
      ) : (
        <div className="card bg-slate-900 border border-slate-800 shadow-2xl p-6 rounded-2xl">
          <div className="overflow-x-auto w-full">
            <table className="table w-full text-left text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-wider border-none">
                  <th className="bg-transparent pb-4 pl-4">Student</th>
                  <th className="bg-transparent pb-4">ID Number</th>
                  <th className="bg-transparent pb-4">Program / Term</th>
                  <th className="bg-transparent pb-4">Purpose</th>
                  <th className="bg-transparent pb-4">Clearance Status</th>
                  <th className="bg-transparent pb-4 pr-4 text-right">Oversight</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="bg-slate-950/40 hover:bg-slate-950/70 border border-slate-855 rounded-xl transition-all">
                    <td className="font-semibold text-white py-4 rounded-l-xl pl-4 flex flex-col justify-center min-w-[150px]">
                      <span>{rec.studentName}</span>
                      <span className="text-[10px] text-slate-500 font-normal mt-0.5">Ref: {rec.applicationNumber}</span>
                    </td>
                    <td className="text-slate-300 py-4 font-mono text-xs">{rec.studentNumber}</td>
                    <td className="text-slate-300 py-4">
                      {rec.program} • {rec.academicYear} ({rec.semester} Sem)
                    </td>
                    <td className="text-slate-300 py-4">
                      <span className="badge badge-sm border border-slate-700 bg-slate-800 text-slate-300 rounded-md font-medium px-2 py-0.5">
                        {rec.purpose}
                      </span>
                    </td>
                    <td className="py-4">
                      {rec.overallStatus === 'approved' ? (
                        <span className="badge badge-sm border border-emerald-800/60 bg-emerald-950/40 text-emerald-400 rounded-md font-medium px-2 py-0.5">
                          Cleared
                        </span>
                      ) : rec.overallStatus === 'not_approved' ? (
                        <span className="badge badge-sm border border-rose-800/60 bg-rose-950/40 text-rose-400 rounded-md font-medium px-2 py-0.5">
                          Hold Remarks
                        </span>
                      ) : (
                        <span className="badge badge-sm border border-amber-800/60 bg-amber-950/40 text-amber-400 rounded-md font-medium px-2 py-0.5">
                          Reviewing
                        </span>
                      )}
                    </td>
                    <td className="py-4 rounded-r-xl pr-4 text-right">
                      <button
                        onClick={() => setSelectedRecord(rec)}
                        className="btn btn-xs btn-outline border-indigo-500/40 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg font-semibold shadow-md active:scale-95 ml-auto"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Details Modal Dialog */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative flex flex-col gap-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">Clearance Overview</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="btn btn-sm btn-ghost hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Overview */}
            <div className="bg-slate-950/40 border border-slate-850/50 p-4 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Student Name:</span>
                <span className="font-semibold text-white">{selectedRecord.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ID Number:</span>
                <span className="font-mono text-white">{selectedRecord.studentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Academic Program:</span>
                <span className="text-white">{selectedRecord.program} ({selectedRecord.yearLevel} - {selectedRecord.section})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Clearance Ref:</span>
                <span className="font-mono text-white">{selectedRecord.applicationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Academic Term:</span>
                <span className="text-white">{selectedRecord.academicYear} • {selectedRecord.semester} Sem</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Submission Date:</span>
                <span className="text-white">{new Date(selectedRecord.submittedAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Status indicators */}
            <div className="space-y-3 p-3 border border-slate-800 bg-slate-950/20 rounded-xl text-center">
              <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider block">Clearance Status</span>
              
              <div className="flex justify-around items-center py-2">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block mb-1">Financials</span>
                  {selectedRecord.financialStatus === 'paid' ? (
                    <span className="badge badge-sm border border-emerald-800/40 bg-emerald-950/40 text-emerald-400 rounded-md">Paid</span>
                  ) : selectedRecord.financialStatus === 'unpaid' ? (
                    <span className="badge badge-sm border border-rose-800/40 bg-rose-950/40 text-rose-400 rounded-md">Unpaid</span>
                  ) : (
                    <span className="badge badge-sm border border-amber-800/40 bg-amber-950/40 text-amber-400 rounded-md">Pending</span>
                  )}
                </div>

                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block mb-1">Adviser Sign-off</span>
                  <span className="badge badge-sm border border-emerald-800/40 bg-emerald-950/40 text-emerald-400 rounded-md">Approved</span>
                </div>

                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block mb-1">Overall Status</span>
                  {selectedRecord.overallStatus === 'approved' ? (
                    <span className="badge badge-sm border border-emerald-800/40 bg-emerald-950/40 text-emerald-400 rounded-md">Cleared</span>
                  ) : selectedRecord.overallStatus === 'not_approved' ? (
                    <span className="badge badge-sm border border-rose-800/40 bg-rose-950/40 text-rose-400 rounded-md">Hold</span>
                  ) : (
                    <span className="badge badge-sm border border-amber-800/40 bg-amber-950/40 text-amber-400 rounded-md">Reviewing</span>
                  )}
                </div>
              </div>
            </div>

            {/* Note banner */}
            <div className="alert alert-info border border-indigo-800/40 bg-indigo-950/20 text-indigo-300 rounded-xl flex items-start gap-2 p-3 text-xs leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Dean Oversight Mode</span>
                The Dean has read-only visibility into student clearance status after Adviser sign-off in the MVP. Direct sign-off buttons are disabled.
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={() => setSelectedRecord(null)}
              className="btn btn-outline border-slate-700 hover:bg-slate-800 text-slate-300 w-full rounded-xl font-semibold tracking-wide h-10 text-xs uppercase mt-2"
            >
              Close Overview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
