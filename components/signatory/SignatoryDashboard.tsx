'use client';

import { normalizeSemester } from '@/lib/academic-term';
import React, { useState, useEffect } from 'react';
import {
  fetchPendingApprovalsAction,
  fetchApprovedHistoryAction,
  signClearanceAction,
  reopenClearanceAction,
} from '@/app/actions/clearance';
import {
  ClipboardList,
  ShieldAlert,
  CheckCircle2,
  User,
  Calendar,
  MessageSquare,
  Search,
  History,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import AccessibleDialog from '@/components/ui/AccessibleDialog';

interface PendingApproval {
  approval_id: string;
  signatory_role: string;
  status: string;
  application_id: string;
  application_number: string;
  academic_year: string;
  semester: string;
  purpose: string;
  submitted_at: string;
  student_id_number: string;
  student_name: string;
  program?: string | null;
}

interface ApprovedHistoryItem {
  approval_id: string;
  signatory_role: string;
  status: string;
  remarks: string | null;
  acted_at: string | null;
  acted_by_name: string | null;
  application_id: string;
  application_number: string;
  academic_year: string;
  semester: string;
  purpose: string;
  submitted_at: string;
  student_id_number: string;
  student_name: string;
  program?: string | null;
  year_level?: string | null;
  overall_status: string;
}

export default function SignatoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [queue, setQueue] = useState<PendingApproval[]>([]);
  const [history, setHistory] = useState<ApprovedHistoryItem[]>([]);
  const [role, setRole] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Review Modal State
  const [selectedApp, setSelectedApp] = useState<PendingApproval | null>(null);
  const [remarks, setRemarks] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approved' | 'pending' | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  // Reopen Modal State
  const [selectedReopenApp, setSelectedReopenApp] = useState<ApprovedHistoryItem | null>(null);
  const [reopenRemarks, setReopenRemarks] = useState('');
  const [reopenLoading, setReopenLoading] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [reopenSuccess, setReopenSuccess] = useState(false);

  const isMounted = React.useRef(true);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        fetchPendingApprovalsAction(),
        fetchApprovedHistoryAction(),
      ]);

      if (isMounted.current) {
        if (pendingRes.success) {
          setQueue((pendingRes.pendingQueue as unknown as PendingApproval[]) || []);
          setRole(pendingRes.role || '');
        } else {
          setError(pendingRes.error || 'Failed to load pending approvals.');
        }

        if (historyRes.success) {
          setHistory((historyRes.approvedHistory as unknown as ApprovedHistoryItem[]) || []);
        }
      }
    } catch (err: unknown) {
      console.error('Error loading dashboard data:', err);
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
    loadData();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleOpenReview = (app: PendingApproval) => {
    setSelectedApp(app);
    setRemarks('');
    setModalError(null);
    setModalSuccess(false);
  };

  const handleAction = async (status: 'approved' | 'pending') => {
    if (!selectedApp) return;

    if (status === 'pending' && (!remarks || remarks.trim() === '')) {
      setModalError('Remarks are required when marking an item Pending.');
      return;
    }

    const confirmation = status === 'pending'
      ? 'Return this clearance requirement to Pending for revision?'
      : 'Approve this clearance requirement?';
    if (!window.confirm(confirmation)) return;

    setModalLoading(true);
    setPendingAction(status);
    setModalError(null);
    setModalSuccess(false);

    try {
      const res = await signClearanceAction({
        applicationId: selectedApp.application_id,
        approvalId: selectedApp.approval_id,
        status,
        remarks,
      });

      if (res.success) {
        setModalSuccess(true);
        setTimeout(() => {
          setSelectedApp(null);
          loadData();
        }, 800);
      } else {
        setModalError(res.error || 'Action failed.');
      }
    } catch (err: unknown) {
      console.error('Approval action error:', err);
      const message = err instanceof Error ? err.message : 'Connection error.';
      setModalError(message);
    } finally {
      setModalLoading(false);
      setPendingAction(null);
    }
  };

  const handleOpenReopen = (app: ApprovedHistoryItem) => {
    setSelectedReopenApp(app);
    setReopenRemarks('');
    setReopenError(null);
    setReopenSuccess(false);
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReopenApp) return;

    const trimmed = reopenRemarks.trim();
    if (!trimmed) {
      setReopenError('A reason or remark is required when returning an approved clearance to pending.');
      return;
    }

    if (!window.confirm('Are you sure you want to return this approved requirement to Pending? Downstream clearance stages will be locked until re-evaluated.')) {
      return;
    }

    setReopenLoading(true);
    setReopenError(null);
    setReopenSuccess(false);

    try {
      const res = await reopenClearanceAction({
        applicationId: selectedReopenApp.application_id,
        approvalId: selectedReopenApp.approval_id,
        remarks: trimmed,
      });

      if (res.success) {
        setReopenSuccess(true);
        setTimeout(() => {
          setSelectedReopenApp(null);
          loadData();
        }, 800);
      } else {
        setReopenError(res.error || 'Failed to reopen clearance approval.');
      }
    } catch (err: unknown) {
      console.error('Reopen error:', err);
      const message = err instanceof Error ? err.message : 'Connection error.';
      setReopenError(message);
    } finally {
      setReopenLoading(false);
    }
  };

  const formatRoleName = (str: string) => {
    if (str === 'dean') return 'DEAN OF BUSINESS PROGRAM';
    return str.replace('_', ' ').toUpperCase();
  };

  const formatSemester = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return 'Unspecified semester';
    try {
      return normalizeSemester(value);
    } catch {
      return value;
    }
  };

  const filteredQueue = queue.filter((app) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.student_name.toLowerCase().includes(q) ||
      app.student_id_number.toLowerCase().includes(q) ||
      app.application_number.toLowerCase().includes(q)
    );
  });

  const filteredHistory = history.filter((app) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.student_name.toLowerCase().includes(q) ||
      app.student_id_number.toLowerCase().includes(q) ||
      app.application_number.toLowerCase().includes(q) ||
      (app.program && app.program.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-base-content">
        <span className="loading loading-spinner loading-lg text-primary mb-2" aria-hidden="true" />
        <p className="text-base-content/70 text-sm font-medium animate-pulse">Loading evaluation queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-base-content tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
            <span>Pending Evaluation Queue</span>
          </h2>
          <p className="text-base-content/70 text-xs mt-1 font-medium">
            Department desk: <span className="font-semibold text-base-content">{formatRoleName(role)}</span>
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`btn btn-sm min-h-11 rounded-xl px-4 text-xs font-semibold transition-all ${
              activeTab === 'pending'
                ? 'bg-primary text-primary-content shadow-sm hover:bg-primary/90'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            <ClipboardList className="w-4 h-4 mr-1 inline" />
            Pending ({queue.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`btn btn-sm min-h-11 rounded-xl px-4 text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-primary text-primary-content shadow-sm hover:bg-primary/90'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            <History className="w-4 h-4 mr-1 inline" />
            Approved History ({history.length})
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error text-error-content rounded-xl flex items-center gap-2 p-3 text-sm font-medium">
          <span>Error: {error}</span>
          <button onClick={loadData} className="btn btn-sm min-h-11 btn-outline border-error text-error rounded-lg ml-auto">
            Retry
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="card bg-base-100 border border-base-content/15 shadow-sm p-4 rounded-xl flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="relative w-full md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/60">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder={activeTab === 'pending' ? 'Search pending students by name or ID...' : 'Search approved students by name, ID, or program...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-bordered w-full pl-9 bg-base-200 border-base-content/15 focus:border-primary text-base-content rounded-xl placeholder-base-content/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary text-sm h-11"
          />
        </div>
        <div className="text-xs text-base-content/60 font-medium">
          Showing {activeTab === 'pending' ? filteredQueue.length : filteredHistory.length} record(s)
        </div>
      </div>

      {/* PENDING QUEUE TAB */}
      {activeTab === 'pending' && (
        <>
          {filteredQueue.length === 0 ? (
            <div className="card bg-base-100 border border-base-content/15 p-10 rounded-xl text-center space-y-3 shadow-sm">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto" aria-hidden="true" />
              <h3 className="text-base-content font-bold text-lg">
                {searchQuery ? 'No Matching Pending Evaluations' : 'No Pending Evaluations'}
              </h3>
              <p className="text-base-content/70 text-xs max-w-sm mx-auto font-medium">
                {searchQuery
                  ? 'No pending student records match your search criteria.'
                  : 'There are currently no student clearance applications waiting for review by this office.'}
              </p>
            </div>
          ) : (
            <div className="card bg-base-100 border border-base-content/15 shadow-sm p-6 rounded-xl">
              <p className="sm:hidden mb-3 text-xs text-base-content/60">Swipe horizontally to view all columns.</p>
              <div className="overflow-x-auto w-full">
                <table className="table w-full text-left text-sm border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-base-content/70 text-xs uppercase tracking-wider border-b border-base-content/10">
                      <th scope="col" className="bg-transparent pb-4 pl-4 font-bold">Student</th>
                      <th scope="col" className="bg-transparent pb-4 font-bold">ID Number</th>
                      <th scope="col" className="bg-transparent pb-4 font-bold">Academic Term</th>
                      <th scope="col" className="bg-transparent pb-4 font-bold">Purpose</th>
                      <th scope="col" className="bg-transparent pb-4 font-bold">Submitted At</th>
                      <th scope="col" className="bg-transparent pb-4 pr-4 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.map((app) => (
                      <tr key={`${app.application_id}-${app.approval_id}`} className="bg-base-200/50 hover:bg-base-200 border border-base-content/10 rounded-xl transition-all">
                        <td className="font-semibold text-base-content py-4 rounded-l-xl pl-4 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
                            <User className="w-4 h-4 text-base-content/60" aria-hidden="true" />
                          </div>
                          <span>{app.student_name}</span>
                        </td>
                        <td className="text-base-content/80 py-4 font-mono text-xs">{app.student_id_number}</td>
                        <td className="text-base-content/80 py-4">
                          {app.academic_year} • {formatSemester(app.semester)}
                        </td>
                        <td className="text-base-content/80 py-4">
                          <span className="badge badge-sm border border-base-content/10 bg-base-300 text-base-content rounded-md font-medium px-2 py-0.5">
                            {app.purpose}
                          </span>
                        </td>
                        <td className="text-base-content/70 py-4 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-base-content/50" aria-hidden="true" />
                            <span>{new Date(app.submitted_at).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="py-4 rounded-r-xl pr-4 text-right">
                          <button
                            onClick={() => handleOpenReview(app)}
                            aria-label={`Review clearance for ${app.student_name}`}
                            className="btn btn-sm min-h-11 btn-primary rounded-lg font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* APPROVED HISTORY TAB */}
      {activeTab === 'history' && (
        <>
          {filteredHistory.length === 0 ? (
            <div className="card bg-base-100 border border-base-content/15 p-10 rounded-xl text-center space-y-3 shadow-sm">
              <History className="w-10 h-10 text-base-content/40 mx-auto" aria-hidden="true" />
              <h3 className="text-base-content font-bold text-lg">
                {searchQuery ? 'No Matching Approved Records' : 'No Approved History Yet'}
              </h3>
              <p className="text-base-content/70 text-xs max-w-sm mx-auto font-medium">
                {searchQuery
                  ? 'No approved records match your search criteria.'
                  : 'Applications approved by this office will appear here in chronological order.'}
              </p>
            </div>
          ) : (
            <div className="card bg-base-100 border border-base-content/15 shadow-sm p-6 rounded-xl">
              <p className="sm:hidden mb-3 text-xs text-base-content/60">Swipe horizontally to view all columns.</p>
              <div className="overflow-x-auto w-full">
                <table className="table w-full text-left text-sm border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-base-content/70 text-xs uppercase tracking-wider border-b border-base-content/10">
                      <th scope="col" className="bg-transparent pb-4 pl-4 font-bold">Student</th>
                      <th scope="col" className="bg-transparent pb-4 font-bold">ID Number</th>
                      <th scope="col" className="bg-transparent pb-4 font-bold">Term & Purpose</th>
                      <th scope="col" className="bg-transparent pb-4 font-bold">Status</th>
                      <th scope="col" className="bg-transparent pb-4 font-bold">Approved Date</th>
                      <th scope="col" className="bg-transparent pb-4 font-bold">Remarks</th>
                      <th scope="col" className="bg-transparent pb-4 pr-4 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item) => (
                      <tr key={`${item.application_id}-${item.approval_id}`} className="bg-base-200/50 hover:bg-base-200 border border-base-content/10 rounded-xl transition-all">
                        <td className="font-semibold text-base-content py-4 rounded-l-xl pl-4 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <div>
                            <div>{item.student_name}</div>
                            {item.program && <div className="text-[10px] text-base-content/60 font-mono">{item.program}</div>}
                          </div>
                        </td>
                        <td className="text-base-content/80 py-4 font-mono text-xs">{item.student_id_number}</td>
                        <td className="text-base-content/80 py-4 text-xs">
                          <div>{item.academic_year} • {formatSemester(item.semester)}</div>
                          <span className="badge badge-xs border border-base-content/10 bg-base-300 text-base-content/80 mt-1">
                            {item.purpose}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="badge badge-sm border border-success/30 bg-success/10 text-success rounded-md font-semibold px-2 py-0.5">
                            Approved
                          </span>
                        </td>
                        <td className="text-base-content/70 py-4 text-xs">
                          {item.acted_at ? new Date(item.acted_at).toLocaleDateString() : '--'}
                        </td>
                        <td className="text-base-content/70 py-4 text-xs max-w-xs truncate">
                          {item.remarks || '--'}
                        </td>
                        <td className="py-4 rounded-r-xl pr-4 text-right">
                          <button
                            onClick={() => handleOpenReopen(item)}
                            aria-label={`Reopen clearance requirement for ${item.student_name}`}
                            className="btn btn-sm min-h-11 btn-outline border-warning/40 text-warning hover:bg-warning hover:text-warning-content rounded-lg font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1 inline" />
                            Reopen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review Accessible Dialog (Only Approve and Mark Pending) */}
      <AccessibleDialog
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title="Evaluate Clearance Requirement"
        description="Review student clearance submission and submit evaluation decision."
        preventClose={modalLoading}
        maxWidthClass="max-w-2xl"
      >
        {selectedApp && (
          <div className="space-y-4">
            {/* Modal Alerts */}
            {modalSuccess && (
              <div role="status" aria-live="polite" className="alert alert-success text-success-content rounded-xl flex items-center gap-2 p-3 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Evaluation updated successfully!</span>
              </div>
            )}

            {modalError && (
              <div role="alert" className="alert alert-error text-error-content rounded-xl flex items-center gap-2 p-3 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Student Info Details */}
            <div className="bg-base-200 border border-base-content/15 p-4 rounded-xl space-y-2 text-sm">
              <div>
                <span className="text-base-content/60 font-medium">Student Name:</span>{' '}
                <span className="font-semibold text-base-content">{selectedApp.student_name}</span>
              </div>
              <div>
                <span className="text-base-content/60 font-medium">ID Number:</span>{' '}
                <span className="font-mono text-base-content">{selectedApp.student_id_number}</span>
              </div>
              <div>
                <span className="text-base-content/60 font-medium">Academic Term:</span>{' '}
                <span className="text-base-content">
                  {selectedApp.academic_year} • {formatSemester(selectedApp.semester)}
                </span>
              </div>
              <div>
                <span className="text-base-content/60 font-medium">Purpose:</span>{' '}
                <span className="text-base-content">{selectedApp.purpose}</span>
              </div>
            </div>

            {/* Evaluation Form */}
            <div className="form-control space-y-1.5">
              <label htmlFor="signatory-remarks" className="label py-0 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-base-content/50" aria-hidden="true" />
                <span className="label-text text-base-content/80 font-medium text-xs">
                  Remarks / Feedback
                </span>
              </label>
              <textarea
                id="signatory-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={modalLoading || modalSuccess}
                placeholder="Enter remarks... (Required when marking Pending)"
                className="textarea textarea-bordered w-full h-24 bg-base-200 border-base-content/15 text-base-content rounded-xl placeholder-base-content/40 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            {/* Modal Actions: Only Mark Pending and Approve Clearance */}
            <div className="space-y-2 mt-4 pt-3 border-t border-base-content/10">
              <div>
                <p className="text-xs font-bold text-base-content">Choose a decision</p>
                <p className="text-[11px] text-base-content/70">Approve when the requirement is complete, or Mark Pending with remarks if revision is needed.</p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2" role="group" aria-label="Clearance decision actions">
                <button
                  onClick={() => handleAction('pending')}
                  disabled={modalLoading || modalSuccess}
                  aria-busy={modalLoading && pendingAction === 'pending'}
                  className="btn btn-sm min-h-11 btn-outline border-base-content/25 text-base-content hover:bg-base-200 rounded-xl text-xs font-semibold tracking-wide uppercase sm:min-w-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/30"
                >
                  {modalLoading && pendingAction === 'pending' ? 'Marking Pending...' : 'Mark Pending'}
                </button>
                <button
                  onClick={() => handleAction('approved')}
                  disabled={modalLoading || modalSuccess}
                  aria-busy={modalLoading && pendingAction === 'approved'}
                  className="btn btn-sm min-h-11 btn-success text-success-content rounded-xl text-xs font-semibold tracking-wide uppercase sm:min-w-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
                >
                  {modalLoading && pendingAction === 'approved' ? 'Approving...' : 'Approve Clearance'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AccessibleDialog>

      {/* Reopen / Return to Pending Accessible Dialog */}
      <AccessibleDialog
        isOpen={!!selectedReopenApp}
        onClose={() => setSelectedReopenApp(null)}
        title="Reopen Clearance Approval"
        description="Return this clearance requirement to Pending status."
        preventClose={reopenLoading}
        maxWidthClass="max-w-lg"
      >
        {selectedReopenApp && (
          <form onSubmit={handleReopen} className="space-y-4">
            <div className="alert alert-warning text-warning-content rounded-xl flex items-start gap-2.5 p-3.5 text-xs font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold">Caution: Return to Pending</p>
                <p className="mt-0.5 text-warning-content/90">
                  Returning this requirement to Pending will invalidate downstream clearance stages until re-evaluated.
                </p>
              </div>
            </div>

            {reopenSuccess && (
              <div role="status" aria-live="polite" className="alert alert-success text-success-content rounded-xl flex items-center gap-2 p-3 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Requirement returned to Pending successfully!</span>
              </div>
            )}

            {reopenError && (
              <div role="alert" className="alert alert-error text-error-content rounded-xl flex items-center gap-2 p-3 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{reopenError}</span>
              </div>
            )}

            <div className="bg-base-200 border border-base-content/15 p-3 rounded-xl space-y-1 text-xs">
              <div><span className="text-base-content/60">Student:</span> <span className="font-semibold text-base-content">{selectedReopenApp.student_name}</span> ({selectedReopenApp.student_id_number})</div>
              <div><span className="text-base-content/60">Application:</span> <span className="font-mono text-base-content">{selectedReopenApp.application_number}</span></div>
              <div><span className="text-base-content/60">Term:</span> <span className="text-base-content">{selectedReopenApp.academic_year} • {formatSemester(selectedReopenApp.semester)}</span></div>
            </div>

            <div className="form-control space-y-1.5">
              <label htmlFor="reopen-remarks" className="label py-0 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-base-content/50" aria-hidden="true" />
                <span className="label-text text-base-content/80 font-medium text-xs">
                  Reason for Reopening <span className="text-error">*</span>
                </span>
              </label>
              <textarea
                id="reopen-remarks"
                value={reopenRemarks}
                onChange={(e) => setReopenRemarks(e.target.value)}
                disabled={reopenLoading || reopenSuccess}
                placeholder="State the reason why this approval is being reopened..."
                rows={3}
                className="textarea textarea-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-base-content/10">
              <button
                type="button"
                onClick={() => setSelectedReopenApp(null)}
                disabled={reopenLoading}
                className="btn btn-sm min-h-11 btn-ghost rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reopenLoading || reopenSuccess}
                className="btn btn-sm min-h-11 btn-warning rounded-xl text-xs font-semibold uppercase tracking-wide"
              >
                {reopenLoading ? 'Returning to Pending...' : 'Confirm Return to Pending'}
              </button>
            </div>
          </form>
        )}
      </AccessibleDialog>
    </div>
  );
}
