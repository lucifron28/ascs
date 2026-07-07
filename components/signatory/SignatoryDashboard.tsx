'use client';

import React, { useState, useEffect } from 'react';
import { fetchPendingApprovalsAction, signClearanceAction } from '@/app/actions/clearance';
import { ClipboardList, ShieldAlert, CheckCircle2, User, Calendar, MessageSquare, X } from 'lucide-react';

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
          setQueue(res.pendingQueue || []);
          setRole(res.role || '');
        } else {
          setError(res.error || 'Failed to load pending approvals.');
        }
      }
    } catch (err: any) {
      console.error('Error loading queue:', err);
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
      setModalError('Remarks are required when requesting revision or disapproving.');
      return;
    }

    setModalLoading(true);
    setModalError(null);
    setModalSuccess(false);

    try {
      const res = await signClearanceAction({
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
    } catch (err: any) {
      console.error('Approval action error:', err);
      setModalError(err.message || 'Connection error.');
    } finally {
      setModalLoading(false);
    }
  };

  const formatRoleName = (str: string) => {
    return str.replace('_', ' ').toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white">
        <span className="loading loading-spinner loading-lg text-indigo-500 mb-2" />
        <p className="text-slate-400 text-sm animate-pulse">Loading evaluation queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-400" /> Pending Evaluation Queue
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Department desk: <span className="font-semibold text-slate-300">{formatRoleName(role)}</span>
          </p>
        </div>
        <div className="badge border border-indigo-800/40 bg-indigo-950/30 text-indigo-300 rounded-lg p-3 font-medium text-xs">
          Pending Applications: {queue.length}
        </div>
      </div>

      {error && (
        <div className="alert alert-error bg-rose-950/80 border-rose-800 text-rose-300 rounded-xl flex items-center gap-2 p-3 text-sm">
          <span>Error: {error}</span>
          <button onClick={loadQueue} className="btn btn-xs btn-outline border-rose-800 text-rose-300 rounded-lg ml-auto">
            Retry
          </button>
        </div>
      )}

      {/* Pending Queue Table */}
      {queue.length === 0 ? (
        <div className="card bg-slate-900 border border-slate-800/50 p-10 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-white font-bold text-lg">Queue Clean!</h3>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">
            There are no student clearance applications waiting for evaluation in your department. Good job!
          </p>
        </div>
      ) : (
        <div className="card bg-slate-900 border border-slate-800 shadow-2xl p-6 rounded-2xl">
          <div className="overflow-x-auto w-full">
            <table className="table w-full text-left text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-wider border-none">
                  <th className="bg-transparent pb-4 pl-4">Student</th>
                  <th className="bg-transparent pb-4">ID Number</th>
                  <th className="bg-transparent pb-4">Academic Term</th>
                  <th className="bg-transparent pb-4">Purpose</th>
                  <th className="bg-transparent pb-4">Submitted At</th>
                  <th className="bg-transparent pb-4 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((app) => (
                  <tr key={app.approval_id} className="bg-slate-950/40 hover:bg-slate-950/70 border border-slate-850 rounded-xl transition-all">
                    <td className="font-semibold text-white py-4 rounded-l-xl pl-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <span>{app.student_name}</span>
                    </td>
                    <td className="text-slate-300 py-4 font-mono text-xs">{app.student_id_number}</td>
                    <td className="text-slate-300 py-4">
                      {app.academic_year} • {app.semester} Sem
                    </td>
                    <td className="text-slate-300 py-4">
                      <span className="badge badge-sm border border-slate-700 bg-slate-800 text-slate-300 rounded-md font-medium px-2 py-0.5">
                        {app.purpose}
                      </span>
                    </td>
                    <td className="text-slate-400 py-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        <span>{new Date(app.submitted_at).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="py-4 rounded-r-xl pr-4 text-right">
                      <button
                        onClick={() => handleOpenReview(app)}
                        className="btn btn-xs btn-primary bg-indigo-600 hover:bg-indigo-500 border-none text-white rounded-lg font-semibold shadow-md active:scale-95"
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

      {/* Review Modal Dialog */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative flex flex-col gap-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                Evaluate Clearance
              </h3>
              <button
                onClick={() => setSelectedApp(null)}
                disabled={modalLoading}
                className="btn btn-sm btn-ghost hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Alerts */}
            {modalSuccess && (
              <div className="alert alert-success bg-emerald-950/80 border-emerald-800 text-emerald-300 rounded-xl flex items-center gap-2 p-3 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Evaluation updated successfully!</span>
              </div>
            )}

            {modalError && (
              <div className="alert alert-error bg-rose-950/80 border-rose-800 text-rose-300 rounded-xl flex items-center gap-2 p-3 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Student Info Details */}
            <div className="bg-slate-950/40 border border-slate-850/50 p-4 rounded-xl space-y-2 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Student Name:</span>{' '}
                <span className="font-semibold text-white">{selectedApp.student_name}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">ID Number:</span>{' '}
                <span className="font-mono text-white">{selectedApp.student_id_number}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Academic Term:</span>{' '}
                <span className="text-white">
                  {selectedApp.academic_year} • {selectedApp.semester} Semester
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Purpose:</span>{' '}
                <span className="text-white">{selectedApp.purpose}</span>
              </div>
            </div>

            {/* Evaluation Form */}
            <div className="form-control space-y-1.5">
              <label className="label py-0 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                <span className="label-text text-slate-300 font-medium text-xs">
                  Remarks / Feedback
                </span>
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={modalLoading || modalSuccess}
                placeholder="Enter remarks here... (Mandatory for Pending/Disapprove actions)"
                className="textarea textarea-bordered w-full h-24 bg-slate-950/50 border-slate-800 focus:border-indigo-500 text-white rounded-xl placeholder-slate-700 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80">
              <button
                onClick={() => handleAction('not_approved')}
                disabled={modalLoading || modalSuccess}
                className="btn btn-sm btn-error bg-rose-950/30 hover:bg-rose-600 border border-rose-800 text-rose-400 hover:text-white rounded-xl text-[10px] font-semibold tracking-wide transition-all uppercase h-9"
              >
                Disapprove
              </button>
              <button
                onClick={() => handleAction('pending')}
                disabled={modalLoading || modalSuccess}
                className="btn btn-sm btn-warning bg-amber-950/30 hover:bg-amber-600 border border-amber-800 text-amber-400 hover:text-white rounded-xl text-[10px] font-semibold tracking-wide transition-all uppercase h-9"
              >
                Revision
              </button>
              <button
                onClick={() => handleAction('approved')}
                disabled={modalLoading || modalSuccess}
                className="btn btn-sm btn-success bg-emerald-600 hover:bg-emerald-500 border-none text-white rounded-xl text-[10px] font-semibold tracking-wide transition-all uppercase h-9"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
