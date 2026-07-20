'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  fetchAdminUsersAction,
  updateUserRoleAction,
  fetchClearanceRequirementsAction,
  updateRequirementAssignmentAction,
  fetchActivityLogsAction,
} from '@/app/actions/admin';
import { seedDatabaseAction } from '@/app/actions/seed';
import { UserRole } from '@/lib/types/roles';
import {
  Users,
  Shield,
  FileCheck,
  Activity,
  Database,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserCheck,
  ListOrdered,
  X,
  Edit,
} from 'lucide-react';

interface UserRecord {
  uid: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  accountStatus: string;
  contactNumber: string;
  createdAt: string;
}

interface RequirementRecord {
  id: string;
  role: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
  assignedSignatoryId: string | null;
  assignedSignatoryName: string | null;
}

interface LogRecord {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  createdAt: string;
}

const ROLES_LIST: { id: UserRole; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'librarian', label: 'Librarian' },
  { id: 'accountant', label: 'Accountant' },
  { id: 'osa_coordinator', label: 'OSA Coordinator' },
  { id: 'guidance_counselor', label: 'Guidance Counselor' },
  { id: 'area_chair', label: 'Area Chair' },
  { id: 'adviser', label: 'Adviser' },
  { id: 'dean', label: 'Dean' },
  { id: 'admin', label: 'System Admin' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'requirements' | 'logs'>('overview');

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [requirements, setRequirements] = useState<RequirementRecord[]>([]);
  const [logs, setLogs] = useState<LogRecord[]>([]);

  // Filtering
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Role Edit Modal State
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  // Requirement Assignment Modal State
  const [selectedReq, setSelectedReq] = useState<RequirementRecord | null>(null);
  const [signatorySearch, setSignatorySearch] = useState('');
  const [assignedSignatoryId, setAssignedSignatoryId] = useState<string | null>(null);
  const [assignedSignatoryName, setAssignedSignatoryName] = useState<string | null>(null);
  const [reqModalLoading, setReqModalLoading] = useState(false);
  const [reqModalError, setReqModalError] = useState<string | null>(null);
  const [reqModalSuccess, setReqModalSuccess] = useState(false);

  // Seeding State
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);

  const isMounted = useRef(true);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, rRes, lRes] = await Promise.all([
        fetchAdminUsersAction(),
        fetchClearanceRequirementsAction(),
        fetchActivityLogsAction(),
      ]);

      if (isMounted.current) {
        if (uRes.success) setUsers(uRes.users || []);
        if (rRes.success) setRequirements(rRes.requirements || []);
        if (lRes.success) setLogs(lRes.logs || []);

        if (!uRes.success) setError(uRes.error || 'Failed to load user accounts.');
      }
    } catch (err: any) {
      if (isMounted.current) {
        console.error('Error loading admin data:', err);
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
    loadData();
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle Role Change
  const handleOpenRoleModal = (u: UserRecord) => {
    setSelectedUser(u);
    setSelectedRole(u.role);
    setModalError(null);
    setModalSuccess(false);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setModalLoading(true);
    setModalError(null);
    setModalSuccess(false);

    try {
      const res = await updateUserRoleAction({
        userId: selectedUser.uid,
        newRole: selectedRole,
      });

      if (res.success) {
        setModalSuccess(true);
        setTimeout(() => {
          setSelectedUser(null);
          loadData();
        }, 800);
      } else {
        setModalError(res.error || 'Failed to update user role.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Connection error.');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Requirement Signatory Update
  const handleOpenReqModal = (r: RequirementRecord) => {
    setSelectedReq(r);
    setAssignedSignatoryId(r.assignedSignatoryId);
    setAssignedSignatoryName(r.assignedSignatoryName);
    setSignatorySearch('');
    setReqModalError(null);
    setReqModalSuccess(false);
  };

  const handleUpdateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    setReqModalLoading(true);
    setReqModalError(null);
    setReqModalSuccess(false);

    try {
      const res = await updateRequirementAssignmentAction({
        requirementId: selectedReq.id,
        assignedSignatoryId,
        assignedSignatoryName,
      });

      if (res.success) {
        setReqModalSuccess(true);
        setTimeout(() => {
          setSelectedReq(null);
          loadData();
        }, 800);
      } else {
        setReqModalError(res.error || 'Failed to update requirement assignment.');
      }
    } catch (err: any) {
      setReqModalError(err.message || 'Connection error.');
    } finally {
      setReqModalLoading(false);
    }
  };

  // Handle Trigger Database Seeding
  const handleRunSeed = async () => {
    setSeedLoading(true);
    setSeedResult(null);
    try {
      const res = await seedDatabaseAction();
      if (res.success) {
        setSeedResult({ success: true, message: res.message || 'Database seeded successfully!' });
        loadData();
      } else {
        setSeedResult({ success: false, message: res.error || 'Seeding failed.' });
      }
    } catch (err: any) {
      setSeedResult({ success: false, message: err.message || 'Failed to execute seeding action.' });
    } finally {
      setSeedLoading(false);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Eligible signatories for assignment modal (users with non-student role matching requirement role)
  const eligibleSignatories = users.filter(
    (u) =>
      selectedReq &&
      u.role === selectedReq.role &&
      (u.fullName.toLowerCase().includes(signatorySearch.toLowerCase()) ||
        u.email.toLowerCase().includes(signatorySearch.toLowerCase()))
  );

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-content/10 shadow-lg">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" /> Admin Control Center
          </h1>
          <p className="text-base-content/70 text-sm mt-1">
            Manage system user accounts, clearance requirement assignments, and audit trails.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-outline btn-sm rounded-xl gap-2 hover:bg-base-content/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs tabs-boxed bg-base-100 p-1.5 rounded-2xl border border-base-content/10 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`tab gap-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'overview' ? 'tab-active bg-primary text-primary-content shadow-md' : 'text-base-content/70'
          }`}
        >
          <Activity className="w-4 h-4" /> Overview
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`tab gap-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'users' ? 'tab-active bg-primary text-primary-content shadow-md' : 'text-base-content/70'
          }`}
        >
          <Users className="w-4 h-4" /> Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('requirements')}
          className={`tab gap-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'requirements' ? 'tab-active bg-primary text-primary-content shadow-md' : 'text-base-content/70'
          }`}
        >
          <ListOrdered className="w-4 h-4" /> Requirements ({requirements.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`tab gap-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'logs' ? 'tab-active bg-primary text-primary-content shadow-md' : 'text-base-content/70'
          }`}
        >
          <FileCheck className="w-4 h-4" /> Audit Logs ({logs.length})
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error rounded-2xl shadow-lg border border-error/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="btn btn-xs btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat bg-base-100 border border-base-content/10 rounded-2xl shadow-sm">
              <div className="stat-figure text-primary">
                <Users className="w-8 h-8 opacity-80" />
              </div>
              <div className="stat-title text-xs font-semibold uppercase tracking-wider">Total System Users</div>
              <div className="stat-value text-3xl font-black text-primary">{users.length}</div>
              <div className="stat-desc text-xs mt-1">Across 9 role types</div>
            </div>

            <div className="stat bg-base-100 border border-base-content/10 rounded-2xl shadow-sm">
              <div className="stat-figure text-secondary">
                <UserCheck className="w-8 h-8 opacity-80" />
              </div>
              <div className="stat-title text-xs font-semibold uppercase tracking-wider">Active Students</div>
              <div className="stat-value text-3xl font-black text-secondary">
                {users.filter((u) => u.role === 'student').length}
              </div>
              <div className="stat-desc text-xs mt-1">Registered accounts</div>
            </div>

            <div className="stat bg-base-100 border border-base-content/10 rounded-2xl shadow-sm">
              <div className="stat-figure text-accent">
                <ListOrdered className="w-8 h-8 opacity-80" />
              </div>
              <div className="stat-title text-xs font-semibold uppercase tracking-wider">Clearance Steps</div>
              <div className="stat-value text-3xl font-black text-accent">{requirements.length}</div>
              <div className="stat-desc text-xs mt-1">Department sign-offs</div>
            </div>

            <div className="stat bg-base-100 border border-base-content/10 rounded-2xl shadow-sm">
              <div className="stat-figure text-info">
                <Activity className="w-8 h-8 opacity-80" />
              </div>
              <div className="stat-title text-xs font-semibold uppercase tracking-wider">Audit Log Items</div>
              <div className="stat-value text-3xl font-black text-info">{logs.length}</div>
              <div className="stat-desc text-xs mt-1">Recent system activities</div>
            </div>
          </div>

          {/* Quick Admin Actions Card */}
          <div className="card bg-base-100 border border-base-content/10 shadow-lg rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Database Operations
            </h2>
            <p className="text-sm text-base-content/70">
              Run environment database seeding to populate initial requirements and demo accounts in development/emulator mode.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleRunSeed}
                disabled={seedLoading}
                className="btn btn-primary rounded-xl gap-2 font-semibold"
              >
                {seedLoading ? <span className="loading loading-spinner loading-sm" /> : <Database className="w-4 h-4" />}
                Trigger Database Seeding
              </button>
            </div>

            {seedResult && (
              <div
                className={`alert ${
                  seedResult.success ? 'alert-success' : 'alert-error'
                } rounded-xl border border-base-content/10 mt-3 flex items-center gap-2 text-sm`}
              >
                {seedResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{seedResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between bg-base-100 p-4 rounded-2xl border border-base-content/10 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/50" />
              <input
                type="text"
                placeholder="Search user by name, email, or username..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="input input-sm input-bordered w-full pl-10 bg-base-200 border-base-content/10 rounded-xl text-sm"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-sm"
            >
              <option value="all">All Roles</option>
              {ROLES_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto bg-base-100 rounded-2xl border border-base-content/10 shadow-sm">
            <table className="table table-zebra w-full text-sm">
              <thead>
                <tr className="border-b border-base-content/10 bg-base-200/50">
                  <th>User Details</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-base-content/50 text-xs">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-base-200/40">
                      <td>
                        <div className="font-bold">{u.fullName}</div>
                        <div className="text-xs text-base-content/60">{u.email}</div>
                      </td>
                      <td className="font-mono text-xs text-base-content/70">{u.username}</td>
                      <td>
                        <span className="badge badge-primary border-primary/20 bg-primary/10 text-primary capitalize font-medium text-xs">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success border-success/20 bg-success/10 text-success capitalize text-xs">
                          {u.accountStatus}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleOpenRoleModal(u)}
                          className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 rounded-lg gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit Role
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REQUIREMENTS TAB */}
      {activeTab === 'requirements' && (
        <div className="space-y-4">
          <div className="bg-base-100 p-4 rounded-2xl border border-base-content/10 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-base-content/70">
              Department Clearance Requirements Sequence
            </h2>
            <p className="text-xs text-base-content/60 mt-1">
              Configure assigned signatories for each department clearance requirement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requirements.map((req) => (
              <div
                key={req.id}
                className="card bg-base-100 border border-base-content/10 shadow-sm rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="badge badge-neutral text-xs font-mono font-bold">Step {req.displayOrder}</span>
                  <span className="badge badge-accent border-accent/20 bg-accent/10 text-accent text-xs capitalize">
                    Role: {req.role.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-base">{req.label}</h3>
                  <p className="text-xs text-base-content/60 mt-1">
                    Assigned Signatory:{' '}
                    <span className="font-semibold text-base-content">
                      {req.assignedSignatoryName || 'Unassigned (Any user with role)'}
                    </span>
                  </p>
                </div>

                <div className="pt-2 border-t border-base-content/10 flex justify-end">
                  <button
                    onClick={() => handleOpenReqModal(req)}
                    className="btn btn-outline btn-xs rounded-lg gap-1 hover:bg-base-content/10"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Assign Signatory
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="overflow-x-auto bg-base-100 rounded-2xl border border-base-content/10 shadow-sm">
            <table className="table table-zebra w-full text-xs">
              <thead>
                <tr className="border-b border-base-content/10 bg-base-200/50">
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-base-content/50 text-xs">
                      No audit log entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="font-mono text-base-content/60">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span className="font-bold">{log.actorName}</span>
                        <span className="ml-1 text-[10px] text-base-content/50 capitalize">({log.actorRole})</span>
                      </td>
                      <td>
                        <span className="badge badge-ghost text-[10px] font-mono capitalize">{log.action}</span>
                      </td>
                      <td className="font-mono">{log.entityType} / {log.entityId.slice(0, 8)}...</td>
                      <td className="font-mono text-[10px] text-base-content/70">
                        {JSON.stringify(log.metadata)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT ROLE MODAL */}
      {selectedUser && (
        <div className="modal modal-open bg-black/60 backdrop-blur-sm z-50">
          <div className="modal-box bg-base-100 border border-base-content/10 rounded-2xl p-6 max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" /> Edit User Role
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div className="bg-base-200/50 p-3 rounded-xl border border-base-content/10 space-y-1 text-xs">
                <div>
                  <span className="text-base-content/60">User: </span>
                  <span className="font-bold text-base-content">{selectedUser.fullName}</span>
                </div>
                <div>
                  <span className="text-base-content/60">Email: </span>
                  <span className="font-mono text-base-content/80">{selectedUser.email}</span>
                </div>
              </div>

              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold">Select New System Role</span>
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="select select-bordered w-full bg-base-200 border-base-content/10 rounded-xl text-sm"
                >
                  {ROLES_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {modalError && (
                <div className="alert alert-error text-xs rounded-xl py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div className="alert alert-success text-xs rounded-xl py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>User role updated successfully!</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading || modalSuccess}
                  className="btn btn-sm btn-primary rounded-xl font-semibold gap-1.5"
                >
                  {modalLoading && <span className="loading loading-spinner loading-xs" />}
                  Save Role Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN SIGNATORY MODAL */}
      {selectedReq && (
        <div className="modal modal-open bg-black/60 backdrop-blur-sm z-50">
          <div className="modal-box bg-base-100 border border-base-content/10 rounded-2xl p-6 max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-accent" /> Assign Requirement Signatory
              </h3>
              <button
                onClick={() => setSelectedReq(null)}
                className="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateRequirement} className="space-y-4">
              <div className="bg-base-200/50 p-3 rounded-xl border border-base-content/10 text-xs">
                <div className="font-bold text-base-content">{selectedReq.label}</div>
                <div className="text-base-content/60 capitalize mt-0.5">Required Role: {selectedReq.role.replace('_', ' ')}</div>
              </div>

              {/* Signatory Options */}
              <div className="space-y-2">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Assigned User Account</span>
                </label>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignedSignatoryId(null);
                      setAssignedSignatoryName(null);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      assignedSignatoryId === null
                        ? 'border-accent bg-accent/10 font-bold'
                        : 'border-base-content/10 bg-base-200/50 hover:bg-base-200'
                    }`}
                  >
                    <span>Unassigned (Any user with role)</span>
                    {assignedSignatoryId === null && <CheckCircle2 className="w-4 h-4 text-accent" />}
                  </button>

                  {eligibleSignatories.map((sig) => (
                    <button
                      key={sig.uid}
                      type="button"
                      onClick={() => {
                        setAssignedSignatoryId(sig.uid);
                        setAssignedSignatoryName(sig.fullName);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                        assignedSignatoryId === sig.uid
                          ? 'border-accent bg-accent/10 font-bold'
                          : 'border-base-content/10 bg-base-200/50 hover:bg-base-200'
                      }`}
                    >
                      <div>
                        <div>{sig.fullName}</div>
                        <div className="text-[10px] text-base-content/60">{sig.email}</div>
                      </div>
                      {assignedSignatoryId === sig.uid && <CheckCircle2 className="w-4 h-4 text-accent" />}
                    </button>
                  ))}
                </div>
              </div>

              {reqModalError && (
                <div className="alert alert-error text-xs rounded-xl py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{reqModalError}</span>
                </div>
              )}

              {reqModalSuccess && (
                <div className="alert alert-success text-xs rounded-xl py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Requirement signatory assignment updated!</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReq(null)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reqModalLoading || reqModalSuccess}
                  className="btn btn-sm btn-accent rounded-xl font-semibold gap-1.5"
                >
                  {reqModalLoading && <span className="loading loading-spinner loading-xs" />}
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
