'use client';

import { normalizeSemester } from '@/lib/academic-term';
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
    } catch (err: unknown) {
      console.error('Error loading Dean records:', err);
      if (isMounted.current) {
        const message = err instanceof Error ? err.message : 'Connection error.';
        setError(message);
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
      <div className="flex flex-col items-center justify-center py-20 text-base-content">
        <span className="loading loading-spinner loading-lg text-primary mb-2" />
        <p className="text-base-content/70 text-sm animate-pulse">Loading academic queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card bg-base-100 border border-base-content/10 shadow-sm p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base-content/60 text-[10px] font-semibold uppercase tracking-wider">Adviser Approved</span>
            <h3 className="text-2xl font-black text-base-content">{records.length}</h3>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-content/10 shadow-sm p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base-content/60 text-[10px] font-semibold uppercase tracking-wider">Fully Cleared</span>
            <h3 className="text-2xl font-black text-base-content">{clearedCount}</h3>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-content/10 shadow-sm p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning">
            <CircleEllipsis className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base-content/60 text-[10px] font-semibold uppercase tracking-wider">In Evaluation</span>
            <h3 className="text-2xl font-black text-base-content">{pendingCount}</h3>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error bg-error/10 border-error/20 text-error-content rounded-xl flex items-center gap-2 p-3 text-sm">
          <span>Error: {error}</span>
          <button onClick={loadRecords} className="btn btn-xs btn-outline border-error/40 text-error-content rounded-lg ml-auto">
            Retry
          </button>
        </div>
      )}

      {/* 2. Filters & Actions Bar */}
      <div className="card bg-base-100 border border-base-content/10 shadow-sm p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4 justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/60">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by student name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-bordered w-full pl-9 bg-base-200 border-base-content/10 focus:border-primary text-base-content rounded-xl placeholder-base-content/50 transition-all focus:outline-none focus:ring-1 focus:ring-primary text-xs h-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
          <button
            onClick={() => setStatusFilter('all')}
            className={`btn btn-xs rounded-lg px-3 h-8 text-[11px] font-semibold border-none ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-base-200 text-base-content/70 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`btn btn-xs rounded-lg px-3 h-8 text-[11px] font-semibold border-none ${
              statusFilter === 'pending'
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-base-200 text-base-content/70 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`btn btn-xs rounded-lg px-3 h-8 text-[11px] font-semibold border-none ${
              statusFilter === 'approved'
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-base-200 text-base-content/70 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            Cleared
          </button>
        </div>
      </div>

      {/* 3. Academic Queue List */}
      {filteredRecords.length === 0 ? (
        <div className="card bg-base-100 border border-base-content/10 p-12 rounded-2xl text-center space-y-2 shadow-sm">
          <CircleEllipsis className="w-8 h-8 text-base-content/50 mx-auto" />
          <h3 className="text-base-content font-bold text-sm">No Student Records Found</h3>
          <p className="text-base-content/70 text-xs">Only applications cleared by academic advisers are visible here.</p>
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-content/10 shadow-xl p-6 rounded-2xl">
          <div className="overflow-x-auto w-full">
            <table className="table w-full min-w-[980px] text-left text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-base-content/70 text-xs uppercase tracking-wider border-b border-base-content/10">
                  <th scope="col" className="bg-transparent pb-4 pl-4 font-bold">Student</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Student No.</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Program</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Year</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Section</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Semester</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Status</th>
                  <th scope="col" className="bg-transparent pb-4 pr-4 text-right font-bold">Oversight</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="bg-base-200/50 hover:bg-base-200 border border-base-content/10 rounded-xl transition-all">
                    <td className="font-semibold text-base-content py-4 rounded-l-xl pl-4 flex flex-col justify-center min-w-[150px]">
                      <span>{rec.studentName}</span>
                      <span className="text-[10px] text-base-content/60 font-normal mt-0.5">Ref: {rec.applicationNumber}</span>
                    </td>
                    <td className="text-base-content/80 py-4 font-mono text-xs">{rec.studentNumber}</td>
                    <td className="text-base-content/80 py-4">{rec.program}</td>
                    <td className="text-base-content/80 py-4">{rec.yearLevel}</td>
                    <td className="text-base-content/80 py-4">{rec.section}</td>
                    <td className="text-base-content/80 py-4 whitespace-nowrap">{normalizeSemester(rec.semester)}</td>
                    <td className="py-4">
                      {rec.overallStatus === 'approved' ? (
                        <span className="badge badge-sm border border-success/30 bg-success/10 text-success rounded-md font-medium px-2 py-0.5">
                          Cleared
                        </span>
                      ) : rec.overallStatus === 'not_approved' ? (
                        <span className="badge badge-sm border border-error/30 bg-error/10 text-error rounded-md font-medium px-2 py-0.5">
                          Hold Remarks
                        </span>
                      ) : (
                        <span className="badge badge-sm border border-warning/30 bg-warning/10 text-warning rounded-md font-medium px-2 py-0.5">
                          Reviewing
                        </span>
                      )}
                    </td>
                    <td className="py-4 rounded-r-xl pr-4 text-right">
                      <button
                        onClick={() => setSelectedRecord(rec)}
                        aria-label={`View oversight details for ${rec.studentName}`}
                        className="btn btn-xs btn-primary rounded-lg font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        <div className="fixed inset-0 bg-base-content/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-base-100 border border-base-content/10 text-base-content w-full max-w-md rounded-2xl shadow-2xl p-6 relative flex flex-col gap-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-base-content/10">
              <h3 className="font-bold text-lg text-base-content">Clearance Overview</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="btn btn-sm btn-ghost hover:bg-base-content/10 text-base-content/70 hover:text-base-content rounded-lg p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Overview */}
            <div className="bg-base-200 border border-base-content/10 p-4 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-base-content/70">Student Name:</span>
                <span className="font-semibold text-base-content">{selectedRecord.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">ID Number:</span>
                <span className="font-mono text-base-content">{selectedRecord.studentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">Academic Program:</span>
                <span className="text-base-content">{selectedRecord.program} ({selectedRecord.yearLevel} - {selectedRecord.section})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">Clearance Ref:</span>
                <span className="font-mono text-base-content">{selectedRecord.applicationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">Academic Term:</span>
                <span className="text-base-content">{selectedRecord.academicYear} • {normalizeSemester(selectedRecord.semester)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/70">Submission Date:</span>
                <span className="text-base-content">{new Date(selectedRecord.submittedAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Status indicators */}
            <div className="space-y-3 p-3 border border-base-content/10 bg-base-200 rounded-xl text-center">
              <span className="text-base-content/70 text-[10px] font-semibold uppercase tracking-wider block">Clearance Status</span>
              
              <div className="flex justify-around items-center py-2">
                <div className="text-center">
                  <span className="text-[10px] text-base-content/70 block mb-1">Financials</span>
                  {selectedRecord.financialStatus === 'paid' ? (
                    <span className="badge badge-sm border border-success/30 bg-success/10 text-success rounded-md">Paid</span>
                  ) : selectedRecord.financialStatus === 'unpaid' ? (
                    <span className="badge badge-sm border border-error/30 bg-error/10 text-error rounded-md">Unpaid</span>
                  ) : (
                    <span className="badge badge-sm border border-warning/30 bg-warning/10 text-warning rounded-md">Pending</span>
                  )}
                </div>

                <div className="text-center">
                  <span className="text-[10px] text-base-content/70 block mb-1">Adviser Sign-off</span>
                  <span className="badge badge-sm border border-success/30 bg-success/10 text-success rounded-md">Approved</span>
                </div>

                <div className="text-center">
                  <span className="text-[10px] text-base-content/70 block mb-1">Overall Status</span>
                  {selectedRecord.overallStatus === 'approved' ? (
                    <span className="badge badge-sm border border-success/30 bg-success/10 text-success rounded-md">Cleared</span>
                  ) : selectedRecord.overallStatus === 'not_approved' ? (
                    <span className="badge badge-sm border border-error/30 bg-error/10 text-error rounded-md">Hold</span>
                  ) : (
                    <span className="badge badge-sm border border-warning/30 bg-warning/10 text-warning rounded-md">Reviewing</span>
                  )}
                </div>
              </div>
            </div>

            {/* Note banner */}
            <div className="alert alert-info border border-info/20 bg-info/10 text-info-content rounded-xl flex items-start gap-2 p-3 text-xs leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 text-info mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Dean Oversight Mode</span>
                The Dean has read-only visibility into student clearance status after Adviser sign-off in the MVP. Direct sign-off buttons are disabled.
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={() => setSelectedRecord(null)}
              className="btn btn-outline border-base-content/20 hover:bg-base-content/10 text-base-content w-full rounded-xl font-semibold tracking-wide h-10 text-xs uppercase mt-2"
            >
              Close Overview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
