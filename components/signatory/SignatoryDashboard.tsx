'use client';

import { normalizeSemester } from '@/lib/academic-term';
import React, { useState, useEffect } from 'react';
import { fetchPendingApprovalsAction, signClearanceAction } from '@/app/actions/clearance';
import { ClipboardList, ShieldAlert, CheckCircle2, User, Calendar, MessageSquare } from 'lucide-react';
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
}

export default function SignatoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<PendingApproval[]>([]);
  const [role, setRole] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Modal State
  const [selectedApp, setSelectedApp] = useState<PendingApproval | null>(null);
  const [remarks, setRemarks] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approved' | 'pending' | 'not_approved' | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  const isMounted = React.useRef(true);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPendingApprovalsAction();
      if (isMounted.current) {
        if (res.success) {
          setQueue((res.pendingQueue as unknown as PendingApproval[]) || []);
          setRole(res.role || '');
        } else {
          setError(res.error || 'Failed to load pending approvals.');
        }
      }
    } catch (err: unknown) {
      console.error('Error loading queue:', err);
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
    loadQueue();
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

  const handleAction = async (status: 'approved' | 'pending' | 'not_approved') => {
    if (!selectedApp) return;

    // Validate mandatory remarks on pending / not_approved
    if (status !== 'approved' && (!remarks || remarks.trim() === '')) {
      setModalError('Remarks are required when marking an item Pending or Not Approved.');
      return;
    }

    const confirmation = status === 'not_approved'
      ? 'Mark this clearance requirement as Not Approved? The student will see your remarks.'
      : status === 'pending'
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
        status: status,
        remarks: remarks,
      });

      if (res.success) {
        setModalSuccess(true);
        setTimeout(() => {
          setSelectedApp(null);
          loadQueue();
        }, 1000);
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

  const formatRoleName = (str: string) => {
    return str.replace('_', ' ').toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-base-content">
        <span className="loading loading-spinner loading-lg text-primary mb-2" aria-hidden="true" />
        <p className="text-base-content/70 text-sm font-medium animate-pulse">Loading evaluation queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        <div className="badge border border-base-content/10 bg-base-200 text-base-content rounded-lg p-3 font-medium text-xs">
          Pending Applications: {queue.length}
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error text-error-content rounded-xl flex items-center gap-2 p-3 text-sm font-medium">
          <span>Error: {error}</span>
          <button onClick={loadQueue} className="btn btn-xs btn-outline border-error text-error-content rounded-lg ml-auto">
            Retry
          </button>
        </div>
      )}

      {/* Pending Queue Table */}
      {queue.length === 0 ? (
        <div className="card bg-base-100 border border-base-content/10 p-10 rounded-2xl text-center space-y-3 shadow-sm">
          <CheckCircle2 className="w-10 h-10 text-success mx-auto" aria-hidden="true" />
          <h3 className="text-base-content font-bold text-lg">No Pending Evaluations</h3>
          <p className="text-base-content/70 text-xs max-w-sm mx-auto font-medium">
            There are currently no student clearance applications waiting for review by this office.
          </p>
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-content/10 shadow-xl p-6 rounded-2xl">
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
                {queue.map((app) => (
                  <tr key={app.approval_id} className="bg-base-200/50 hover:bg-base-200 border border-base-content/10 rounded-xl transition-all">
                    <td className="font-semibold text-base-content py-4 rounded-l-xl pl-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
                        <User className="w-4 h-4 text-base-content/60" aria-hidden="true" />
                      </div>
                      <span>{app.student_name}</span>
                    </td>
                    <td className="text-base-content/80 py-4 font-mono text-xs">{app.student_id_number}</td>
                    <td className="text-base-content/80 py-4">
                      {app.academic_year} • {normalizeSemester(app.semester)}
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
                        className="btn btn-xs btn-primary rounded-lg font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

      {/* Review Accessible Dialog */}
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
            <div className="bg-base-200 border border-base-content/10 p-4 rounded-xl space-y-2 text-xs">
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
                  {selectedApp.academic_year} • {normalizeSemester(selectedApp.semester)}
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
                placeholder="Enter remarks... (Required for Mark Pending or Mark Not Approved actions)"
                className="textarea textarea-bordered w-full h-24 bg-base-200 border-base-content/10 text-base-content rounded-xl placeholder-base-content/40 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            {/* Modal Actions */}
            <div className="space-y-2 mt-4 pt-3 border-t border-base-content/10">
              <div>
                <p className="text-xs font-bold text-base-content">Choose a decision</p>
                <p className="text-[11px] text-base-content/70">Approve when the requirement is complete. Use Pending or Not Approved with a clear remark.</p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2" role="group" aria-label="Clearance decision actions">
              <button
                onClick={() => handleAction('not_approved')}
                disabled={modalLoading || modalSuccess}
                aria-busy={modalLoading && pendingAction === 'not_approved'}
                className="btn btn-sm btn-outline border-error text-base-content hover:bg-error hover:text-error-content rounded-xl text-[10px] font-semibold tracking-wide uppercase h-10 sm:min-w-36 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
              >
                {modalLoading && pendingAction === 'not_approved' ? 'Marking Not Approved...' : 'Mark Not Approved'}
              </button>
              <button
                onClick={() => handleAction('pending')}
                disabled={modalLoading || modalSuccess}
                aria-busy={modalLoading && pendingAction === 'pending'}
                className="btn btn-sm btn-outline border-base-content/20 text-base-content hover:bg-base-content/10 rounded-xl text-[10px] font-semibold tracking-wide uppercase h-10 sm:min-w-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/30"
              >
                {modalLoading && pendingAction === 'pending' ? 'Marking Pending...' : 'Mark Pending'}
              </button>
              <button
                onClick={() => handleAction('approved')}
                disabled={modalLoading || modalSuccess}
                aria-busy={modalLoading && pendingAction === 'approved'}
                className="btn btn-sm btn-success text-success-content rounded-xl text-[10px] font-semibold tracking-wide uppercase h-10 sm:min-w-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
              >
                {modalLoading && pendingAction === 'approved' ? 'Approving...' : 'Approve Clearance'}
              </button>
              </div>
            </div>
          </div>
        )}
      </AccessibleDialog>
    </div>
  );
}
