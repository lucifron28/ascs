'use client';

import React, { useState, useEffect } from 'react';
import { fetchFinancialQueueAction, updateFinancialStatusAction } from '@/app/actions/clearance';
import { CreditCard, CheckCircle2, ShieldAlert, AlertCircle, CircleEllipsis, Search, FileText } from 'lucide-react';
import AccessibleDialog from '@/components/ui/AccessibleDialog';
import {
  canSaveFinancialDecision,
  getFinancialNotesDisplay,
  getInitialFinancialDecision,
  type FinancialDecision,
} from '@/lib/clearance/financial-ui';

interface FinancialRecord {
  id: string;
  application_id: string;
  student_id: string;
  status: 'pending' | 'paid' | 'unpaid';
  notes: string | null;
  verified_at: string | null;
  recorded_at: string;
  application_number: string;
  academic_year: string;
  semester: string;
  purpose: string;
  overall_status: string;
  student_name: string;
  student_id_number: string;
  is_actionable?: boolean;
}

export default function AccountantDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<FinancialRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<FinancialRecord | null>(null);
  const [statusInput, setStatusInput] = useState<FinancialDecision>(null);
  const [notesInput, setNotesInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  const isMounted = React.useRef(true);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFinancialQueueAction();
      if (isMounted.current) {
        if (res.success) {
          setRecords((res.financialQueue || []) as unknown as FinancialRecord[]);
          setHistoryRecords((res.financialHistory || []) as unknown as FinancialRecord[]);
        } else {
          setError(res.error || 'Unable to load financial records. Please try again.');
        }
      }
    } catch (err: unknown) {
      console.error('Error loading records:', err);
      if (isMounted.current) {
        setError('Unable to load financial records. Please try again.');
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

  const handleOpenUpdate = (rec: FinancialRecord) => {
    if (showHistory || rec.is_actionable === false || rec.status === 'paid') return;
    setSelectedRecord(rec);
    setStatusInput(getInitialFinancialDecision(rec.status));
    setNotesInput(rec.notes || '');
    setModalError(null);
    setModalSuccess(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!canSaveFinancialDecision(statusInput)) {
      setModalError('Select Paid or Unpaid before saving.');
      return;
    }

    const confirmation = statusInput === 'unpaid'
      ? 'Mark this application Financially Unpaid? A remark is required and the clearance cannot be approved.'
      : 'Mark this application Financially Paid? This can make the clearance printable once all signatories approve.';
    if (!window.confirm(confirmation)) return;

    setModalLoading(true);
    setModalError(null);
    setModalSuccess(false);

    try {
      const res = await updateFinancialStatusAction({
        recordId: selectedRecord.id,
        status: statusInput,
        financialRemarks: notesInput,
      });

      if (res.success) {
        setModalSuccess(true);
        setTimeout(() => {
          setSelectedRecord(null);
          loadRecords();
        }, 1000);
      } else {
        setModalError(res.error || 'Failed to update record.');
      }
    } catch (err: unknown) {
      console.error('Error updating status:', err);
      setModalError('Unable to update the financial status. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  // Filtered List
  const visibleRecords = showHistory ? historyRecords : records;
  const filteredRecords = visibleRecords.filter((rec) => {
    const matchesSearch =
      rec.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.student_id_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.application_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = records.filter((r) => r.status === 'pending').length;
  const unpaidCount = records.filter((r) => r.status === 'unpaid').length;
  const paidCount = historyRecords.filter((r) => r.status === 'paid').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-base-content font-sans">
        <span className="loading loading-spinner loading-lg text-primary mb-2" />
        <p className="text-base-content/70 text-sm animate-pulse">Loading financial accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="card bg-base-100 border border-base-content/15 shadow-sm p-5 rounded-xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base-content/60 text-[10px] font-semibold uppercase tracking-wider">Actionable Accounts</span>
            <h3 className="text-2xl font-black text-base-content">{records.length}</h3>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-content/15 shadow-sm p-5 rounded-xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning">
            <CircleEllipsis className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base-content/60 text-[10px] font-semibold uppercase tracking-wider">Pending Audit</span>
            <h3 className="text-2xl font-black text-base-content">{pendingCount}</h3>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-content/15 shadow-sm p-5 rounded-xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base-content/60 text-[10px] font-semibold uppercase tracking-wider">Paid / Cleared</span>
            <h3 className="text-2xl font-black text-base-content">{paidCount}</h3>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-content/15 shadow-sm p-5 rounded-xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-error/10 border border-error/20 flex items-center justify-center text-error">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-base-content/60 text-[10px] font-semibold uppercase tracking-wider">Unpaid Dues</span>
            <h3 className="text-2xl font-black text-base-content">{unpaidCount}</h3>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert bg-error/10 border border-error/30 text-error rounded-xl flex items-center gap-2 p-3 text-sm">
          <span>Error: {error}</span>
          <button onClick={loadRecords} className="btn btn-xs btn-outline border-error/40 text-error rounded-lg ml-auto">
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
            onClick={() => setStatusFilter('unpaid')}
            className={`btn btn-sm min-h-11 rounded-lg px-3 text-xs font-semibold border-none ${
              statusFilter === 'unpaid'
                ? 'bg-primary text-primary-content hover:bg-primary/90'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            Unpaid Dues
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`btn btn-sm min-h-11 rounded-lg px-3 text-xs font-semibold border-none ${
              statusFilter === 'paid'
                ? 'bg-primary text-primary-content hover:bg-primary/90'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            Paid / Cleared
          </button>
          <button
            onClick={() => {
              setShowHistory((current) => !current);
              setStatusFilter('all');
            }}
            className={`btn btn-sm min-h-11 rounded-lg px-3 text-xs font-semibold border-none ${
              showHistory
                ? 'bg-secondary text-secondary-content hover:bg-secondary/90'
                : 'bg-base-200 text-base-content/80 hover:bg-base-300 hover:text-base-content'
            }`}
          >
            {showHistory ? 'Back to Action Queue' : `Completed History (${paidCount})`}
          </button>
        </div>
      </div>

      {/* 3. Accounts Queue List */}
      {filteredRecords.length === 0 ? (
        <div className="card bg-base-100 border border-base-content/15 p-12 rounded-xl text-center space-y-2 shadow-sm">
          <CircleEllipsis className="w-8 h-8 text-base-content/50 mx-auto" aria-hidden="true" />
          <h3 className="text-base-content font-bold text-sm">{showHistory ? 'No Completed Financial Reviews' : 'No Actionable Accounts'}</h3>
          <p className="text-base-content/70 text-xs font-medium">{showHistory ? 'No paid records are available in the completed history.' : 'Students appear here after Librarian Clearance is approved.'}</p>
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-content/15 shadow-sm p-6 rounded-xl">
          <p className="sm:hidden mb-3 text-xs text-base-content/60">Swipe horizontally to view all columns.</p>
          <div className="overflow-x-auto w-full">
            <table className="table w-full min-w-[960px] text-left text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-base-content/70 text-xs uppercase tracking-wider border-b border-base-content/10">
                  <th scope="col" className="bg-transparent pb-4 pl-4 font-bold">Student</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Student No.</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Account Status</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Pending Dues Notes</th>
                  <th scope="col" className="bg-transparent pb-4 font-bold">Last Verified</th>
                  <th scope="col" className="bg-transparent pb-4 pr-4 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="bg-base-200/50 hover:bg-base-200 border border-base-content/10 rounded-xl transition-all">
                    <td className="font-semibold text-base-content py-4 rounded-l-xl pl-4 flex flex-col justify-center min-w-[150px]">
                      <span>{rec.student_name}</span>
                      <span className="text-[10px] text-base-content/60 font-normal mt-0.5">Ref: {rec.application_number}</span>
                    </td>
                    <td className="text-base-content/80 py-4 font-mono text-xs">{rec.student_id_number}</td>
                    <td className="py-4">
                      {rec.status === 'paid' ? (
                        <span className="badge badge-sm border border-success/30 bg-success/10 text-success rounded-md font-semibold px-2 py-0.5">
                          Paid / Settled
                        </span>
                      ) : rec.status === 'unpaid' ? (
                        <span className="badge badge-sm border border-error/30 bg-error/10 text-error rounded-md font-semibold px-2 py-0.5">
                          Unpaid Dues
                        </span>
                      ) : (
                        <span className="badge badge-sm border border-warning/30 bg-warning/10 text-warning rounded-md font-semibold px-2 py-0.5">
                          Pending Audit
                        </span>
                      )}
                    </td>
                    <td className="text-base-content/80 py-4 text-xs max-w-xs truncate">
                      {getFinancialNotesDisplay(rec.status, rec.notes)}
                    </td>
                    <td className="text-base-content/70 py-4 text-xs">
                      {rec.verified_at ? new Date(rec.verified_at).toLocaleDateString() : '--'}
                    </td>
                    <td className="py-4 rounded-r-xl pr-4 text-right">
                      {showHistory || rec.is_actionable === false || rec.status === 'paid' ? (
                        <span className="text-xs font-semibold text-base-content/60 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" aria-hidden="true" /> Completed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleOpenUpdate(rec)}
                          aria-label={`Update financial status for ${rec.student_name}`}
                          className="btn btn-sm min-h-11 btn-primary rounded-lg font-semibold shadow-sm flex items-center gap-1 ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <FileText className="w-3 h-3" aria-hidden="true" /> Update
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Update Balance Accessible Dialog */}
      <AccessibleDialog
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title="Update Financial Account"
        description="Verify or update student financial accountability status."
        preventClose={modalLoading}
        maxWidthClass="max-w-md"
      >
        {selectedRecord && (
          <form onSubmit={handleUpdate} className="space-y-4">
            {/* Modal Alerts */}
            {modalSuccess && (
              <div role="status" aria-live="polite" className="alert alert-success text-success-content rounded-xl flex items-center gap-2 p-3 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Account status updated successfully!</span>
              </div>
            )}

            {modalError && (
              <div role="alert" className="alert alert-error text-error-content rounded-xl flex items-center gap-2 p-3 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Account Info Details */}
            <div className="bg-base-200 border border-base-content/10 p-4 rounded-xl space-y-2 text-xs">
              <div>
                <span className="text-base-content/60 font-medium">Student Name:</span>{' '}
                <span className="font-semibold text-base-content">{selectedRecord.student_name}</span>
              </div>
              <div>
                <span className="text-base-content/60 font-medium">ID Number:</span>{' '}
                <span className="font-mono text-base-content">{selectedRecord.student_id_number}</span>
              </div>
              <div>
                <span className="text-base-content/60 font-medium">Academic Term:</span>{' '}
                <span className="text-base-content">
                  {selectedRecord.academic_year} • {selectedRecord.semester}
                </span>
              </div>
              <div>
                <span className="text-base-content/60 font-medium">Purpose:</span>{' '}
                <span className="text-base-content">{selectedRecord.purpose}</span>
              </div>
            </div>

            {/* Radio Select for Financial Status */}
            <fieldset className="form-control space-y-2">
              <legend className="text-xs font-bold text-base-content/80">Select Account Status</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className={`label cursor-pointer border rounded-xl p-3 flex items-center justify-between transition-all ${
                  statusInput === 'paid'
                    ? 'border-success bg-success/10 text-base-content font-semibold'
                    : 'border-base-content/10 bg-base-200 text-base-content/70'
                }`}>
                  <span className="text-xs">Mark Financially Paid</span>
                  <input
                    type="radio"
                    name="financialStatus"
                    value="paid"
                    checked={statusInput === 'paid'}
                    onChange={() => setStatusInput('paid')}
                    disabled={modalLoading || modalSuccess}
                    className="radio radio-xs radio-success"
                  />
                </label>
                <label className={`label cursor-pointer border rounded-xl p-3 flex items-center justify-between transition-all ${
                  statusInput === 'unpaid'
                    ? 'border-error bg-error/10 text-base-content font-semibold'
                    : 'border-base-content/10 bg-base-200 text-base-content/70'
                }`}>
                  <span className="text-xs">Mark Unpaid Dues</span>
                  <input
                    type="radio"
                    name="financialStatus"
                    value="unpaid"
                    checked={statusInput === 'unpaid'}
                    onChange={() => setStatusInput('unpaid')}
                    disabled={modalLoading || modalSuccess}
                    className="radio radio-xs radio-error"
                  />
                </label>
              </div>
              {statusInput === null && (
                <p className="text-xs text-base-content/70" id="financial-status-help">
                  Select Paid or Unpaid before saving.
                </p>
              )}
            </fieldset>

            {/* Remarks Input */}
            <div className="form-control space-y-1.5">
              <label htmlFor="financial-remarks" className="label py-0">
                <span className="label-text text-base-content/80 font-medium text-xs">
                  Account Notes / Remarks
                </span>
              </label>
              <textarea
                id="financial-remarks"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                disabled={modalLoading || modalSuccess}
                placeholder="Enter financial audit notes or details on outstanding obligations..."
                className="textarea textarea-bordered w-full h-20 bg-base-200 border-base-content/10 text-base-content rounded-xl placeholder-base-content/40 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex justify-end gap-2 border-t border-base-content/10">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                disabled={modalLoading}
                className="btn btn-sm btn-ghost rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalLoading || modalSuccess || !canSaveFinancialDecision(statusInput)}
                aria-describedby={statusInput === null ? 'financial-status-help' : undefined}
                aria-busy={modalLoading}
                className="btn btn-sm btn-primary rounded-xl text-xs font-semibold px-5"
              >
                {modalLoading ? 'Saving financial status...' : 'Save Financial Status'}
              </button>
            </div>
          </form>
        )}
      </AccessibleDialog>
    </div>
  );
}
