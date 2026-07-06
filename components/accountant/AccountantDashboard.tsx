'use client';

import React, { useState, useEffect } from 'react';
import { fetchFinancialQueueAction, updateFinancialStatusAction } from '@/app/actions/clearance';
import { CreditCard, CheckCircle2, ShieldAlert, X, AlertCircle, CircleEllipsis, Search, FileText } from 'lucide-react';

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
}

export default function AccountantDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<FinancialRecord | null>(null);
  const [statusInput, setStatusInput] = useState<'paid' | 'unpaid'>('unpaid');
  const [notesInput, setNotesInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFinancialQueueAction();
      if (res.success) {
        setRecords(res.financialQueue || []);
      } else {
        setError(res.error || 'Failed to retrieve financial accounts.');
      }
    } catch (err: any) {
      console.error('Error loading records:', err);
      setError(err.message || 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleOpenUpdate = (rec: FinancialRecord) => {
    setSelectedRecord(rec);
    setStatusInput(rec.status === 'pending' ? 'unpaid' : rec.status);
    setNotesInput(rec.notes || '');
    setModalError(null);
    setModalSuccess(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setModalLoading(true);
    setModalError(null);
    setModalSuccess(false);

    try {
      const res = await updateFinancialStatusAction({
        recordId: selectedRecord.id,
        status: statusInput,
        notes: notesInput,
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
    } catch (err: any) {
      console.error('Error updating status:', err);
      setModalError(err.message || 'Connection error.');
    } finally {
      setModalLoading(false);
    }
  };

  // Filtered List
  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      rec.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.student_id_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.application_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = records.filter((r) => r.status === 'pending').length;
  const unpaidCount = records.filter((r) => r.status === 'unpaid').length;
  const paidCount = records.filter((r) => r.status === 'paid').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white font-sans">
        <span className="loading loading-spinner loading-lg text-indigo-500 mb-2" />
        <p className="text-slate-400 text-sm animate-pulse">Loading financial accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="card bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Total Accounts</span>
            <h3 className="text-2xl font-black text-white">{records.length}</h3>
          </div>
        </div>

        <div className="card bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-950 border border-amber-800/40 flex items-center justify-center text-amber-400">
            <CircleEllipsis className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Pending Audit</span>
            <h3 className="text-2xl font-black text-white">{pendingCount}</h3>
          </div>
        </div>

        <div className="card bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Paid / Cleared</span>
            <h3 className="text-2xl font-black text-white">{paidCount}</h3>
          </div>
        </div>

        <div className="card bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-950 border border-rose-800/40 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Unpaid Dues</span>
            <h3 className="text-2xl font-black text-white">{unpaidCount}</h3>
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
            onClick={() => setStatusFilter('unpaid')}
            className={`btn btn-xs rounded-lg px-3 h-8 text-[11px] font-semibold border-none ${
              statusFilter === 'unpaid'
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Unpaid Dues
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`btn btn-xs rounded-lg px-3 h-8 text-[11px] font-semibold border-none ${
              statusFilter === 'paid'
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Paid / Cleared
          </button>
        </div>
      </div>

      {/* 3. Accounts Queue List */}
      {filteredRecords.length === 0 ? (
        <div className="card bg-slate-900 border border-slate-800/40 p-12 rounded-2xl text-center space-y-2">
          <CircleEllipsis className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-slate-400 font-bold text-sm">No Accounts Found</h3>
          <p className="text-slate-600 text-xs">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="card bg-slate-900 border border-slate-800 shadow-2xl p-6 rounded-2xl">
          <div className="overflow-x-auto w-full">
            <table className="table w-full text-left text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-wider border-none">
                  <th className="bg-transparent pb-4 pl-4">Student</th>
                  <th className="bg-transparent pb-4">ID Number</th>
                  <th className="bg-transparent pb-4">Account Status</th>
                  <th className="bg-transparent pb-4">Pending Dues Notes</th>
                  <th className="bg-transparent pb-4">Last Verified</th>
                  <th className="bg-transparent pb-4 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="bg-slate-950/40 hover:bg-slate-950/70 border border-slate-855 rounded-xl transition-all">
                    <td className="font-semibold text-white py-4 rounded-l-xl pl-4 flex flex-col justify-center min-w-[150px]">
                      <span>{rec.student_name}</span>
                      <span className="text-[10px] text-slate-500 font-normal mt-0.5">Ref: {rec.application_number}</span>
                    </td>
                    <td className="text-slate-300 py-4 font-mono text-xs">{rec.student_id_number}</td>
                    <td className="py-4">
                      {rec.status === 'paid' ? (
                        <span className="badge badge-sm border border-emerald-800/60 bg-emerald-950/40 text-emerald-400 rounded-md font-medium px-2 py-0.5">
                          Paid / Settled
                        </span>
                      ) : rec.status === 'unpaid' ? (
                        <span className="badge badge-sm border border-rose-800/60 bg-rose-950/40 text-rose-400 rounded-md font-medium px-2 py-0.5">
                          Unpaid Dues
                        </span>
                      ) : (
                        <span className="badge badge-sm border border-amber-800/60 bg-amber-950/40 text-amber-400 rounded-md font-medium px-2 py-0.5">
                          Pending Audit
                        </span>
                      )}
                    </td>
                    <td className="text-slate-300 py-4 text-xs italic max-w-xs truncate">
                      {rec.notes && rec.notes.trim() !== '' ? `"${rec.notes}"` : 'No outstanding balances.'}
                    </td>
                    <td className="text-slate-400 py-4 text-xs">
                      {rec.verified_at ? new Date(rec.verified_at).toLocaleDateString() : '--'}
                    </td>
                    <td className="py-4 rounded-r-xl pr-4 text-right">
                      <button
                        onClick={() => handleOpenUpdate(rec)}
                        className="btn btn-xs btn-primary bg-indigo-600 hover:bg-indigo-500 border-none text-white rounded-lg font-semibold shadow-md active:scale-95 flex items-center gap-1 ml-auto"
                      >
                        <FileText className="w-3 h-3" /> Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Update Balance Modal Dialog */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative flex flex-col gap-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">Update Financial Account</h3>
              <button
                onClick={() => setSelectedRecord(null)}
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
                <span>Account status updated successfully!</span>
              </div>
            )}

            {modalError && (
              <div className="alert alert-error bg-rose-950/80 border-rose-800 text-rose-300 rounded-xl flex items-center gap-2 p-3 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleUpdate} className="space-y-4">
              {/* Student Overview */}
              <div className="bg-slate-950/40 border border-slate-850/50 p-4 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Student Name:</span>{' '}
                  <span className="font-semibold text-white">{selectedRecord.student_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">ID Number:</span>{' '}
                  <span className="font-mono text-white">{selectedRecord.student_id_number}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Clearance Ref:</span>{' '}
                  <span className="font-mono text-white">{selectedRecord.application_number}</span>
                </div>
              </div>

              {/* Status Toggles */}
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-slate-300 font-medium text-xs">Financial Status</span>
                </label>
                <div className="flex gap-4 bg-slate-950/50 p-2 border border-slate-800 rounded-xl justify-around">
                  <label className="label cursor-pointer flex gap-2 justify-start py-1">
                    <input
                      type="radio"
                      name="status"
                      value="unpaid"
                      checked={statusInput === 'unpaid'}
                      onChange={() => setStatusInput('unpaid')}
                      disabled={modalLoading || modalSuccess}
                      className="radio radio-error"
                    />
                    <span className="label-text text-slate-300 text-xs">Unpaid Balance</span>
                  </label>
                  <label className="label cursor-pointer flex gap-2 justify-start py-1">
                    <input
                      type="radio"
                      name="status"
                      value="paid"
                      checked={statusInput === 'paid'}
                      onChange={() => setStatusInput('paid')}
                      disabled={modalLoading || modalSuccess}
                      className="radio radio-success"
                    />
                    <span className="label-text text-slate-300 text-xs">Paid / Cleared</span>
                  </label>
                </div>
              </div>

              {/* Dues description Notes */}
              <div className="form-control space-y-1.5">
                <label className="label py-0">
                  <span className="label-text text-slate-300 font-medium text-xs">Account Dues details / Notes</span>
                </label>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  disabled={modalLoading || modalSuccess}
                  placeholder="Enter balance breakdown or payment references here... (e.g. Missing library book fine - PHP 250)"
                  className="textarea textarea-bordered w-full h-24 bg-slate-950/50 border-slate-800 focus:border-indigo-500 text-white rounded-xl placeholder-slate-700 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                />
              </div>

              {/* Confirm */}
              <button
                type="submit"
                disabled={modalLoading || modalSuccess}
                className="btn btn-primary w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-none text-white rounded-xl font-semibold tracking-wide shadow-lg shadow-indigo-950/30 active:scale-95 h-11 text-xs uppercase mt-6"
              >
                {modalLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Update Balance Status'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
