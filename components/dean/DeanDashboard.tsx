'use client';

import { normalizeSemester } from '@/lib/academic-term';
import React, { useState, useEffect } from 'react';
import { fetchDeanApplicationsAction } from '@/app/actions/clearance';
import { ClipboardList, ShieldAlert, CheckCircle2, Search, CircleEllipsis } from 'lucide-react';
import AccessibleDialog from '@/components/ui/AccessibleDialog';

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
        <div className="card bg-base-100 border border-base-content/15 shadow-sm p-5 rounded-xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base-content/60 text-[10px] font-semibold uppercase tracking-wider">Adviser Approved</span>
            <h3 className="text-2xl font-black text-base-content">{records.length}</h3>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-content/15 shadow-sm p-5 rounded-xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base-content/60 text-[10px] font-semibold uppercase tracking-wider">Fully Cleared</span>
            <h3 className="text-2xl font-black text-base-content">{clearedCount}</h3>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-content/15 shadow-sm p-5 rounded-xl flex flex-row items-center gap-4">
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
      <div className="card bg-base-100 border border-base-content/15 shadow-sm p-4 rounded-xl flex flex-col md:flex-row items-center gap-4 justify-between">
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
            className="input input-bordered w-full pl-9 bg-base-200 border-base-content/15 focus:border-primary text-base-content rounded-xl placeholder-base-content/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary text-sm h-11"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
          <button
            onClick={() => setStatusFilter('all')}
            className={`btn btn-sm min-h-11 rounded-lg px-3 text-xs font-semibold border-none ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-content hover:bg-primary/90'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`btn btn-sm min-h-11 rounded-lg px-3 text-xs font-semibold border-none ${
              statusFilter === 'pending'
                ? 'bg-primary text-primary-content hover:bg-primary/90'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`btn btn-sm min-h-11 rounded-lg px-3 text-xs font-semibold border-none ${
              statusFilter === 'approved'
                ? 'bg-primary text-primary-content hover:bg-primary/90'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            Cleared
          </button>
        </div>
      </div>

      {/* 3. Academic Queue List */}
      {filteredRecords.length === 0 ? (
        <div className="card bg-base-100 border border-base-content/15 p-12 rounded-xl text-center space-y-2 shadow-sm">
          <CircleEllipsis className="w-8 h-8 text-base-content/50 mx-auto" />
          <h3 className="text-base-content font-bold text-sm">No Student Records Found</h3>
          <p className="text-base-content/70 text-xs">Only applications cleared by academic advisers are visible here.</p>
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-content/15 shadow-sm p-6 rounded-xl">
          <p className="sm:hidden mb-3 text-xs text-base-content/60">Swipe horizontally to view all columns.</p>
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
                        className="btn btn-sm min-h-11 btn-primary rounded-lg font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      <AccessibleDialog
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title="Clearance Overview"
        description="Read-only oversight details for the selected clearance application."
        maxWidthClass="max-w-md"
      >
        {selectedRecord && (
          <div className="space-y-4">

            {/* Overview */}
            <div className="bg-base-200 border border-base-content/15 p-4 rounded-xl space-y-2.5 text-sm">
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
            <div className="space-y-3 p-3 border border-base-content/15 bg-base-200 rounded-xl text-center">
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
            <div className="alert alert-info border border-info/30 bg-info/10 text-base-content rounded-xl flex items-start gap-2 p-3 text-sm leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 text-info mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-bold block mb-0.5">Dean Oversight Mode</span>
                The Dean has read-only visibility into student clearance status after Adviser sign-off in the MVP. Direct sign-off buttons are disabled.
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={() => setSelectedRecord(null)}
              className="btn btn-sm min-h-11 btn-outline border-base-content/25 hover:bg-base-200 text-base-content w-full rounded-xl font-semibold tracking-wide text-xs uppercase mt-2"
            >
              Close Overview
            </button>
          </div>
        )}
      </AccessibleDialog>
    </div>
  );
}
