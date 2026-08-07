'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  fetchAdminUsersAction,
  updateUserRoleAction,
  fetchClearanceRequirementsAction,
  updateRequirementAssignmentAction,
  fetchActivityLogsAction,
} from '@/app/actions/admin';
import {
  createStudentAccountAction,
  createStaffAccountAction,
  deactivateUserAccountAction,
  reactivateUserAccountAction,
  resetUserTemporaryPasswordAction,
} from '@/app/actions/admin-accounts';
import { UserRole } from '@/lib/types/roles';
import { VALID_STAFF_ROLES } from '@/lib/admin/lifecycle-validation';
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
  UserPlus,
  KeyRound,
  UserX,
  UserCheck2,
  Copy,
  Check,
} from 'lucide-react';
interface UserRecord {
  uid: string;
  email: string;
  username?: string;
  fullName: string;
  role: UserRole;
  accountStatus: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
  studentNumber?: string;
  contactNumber?: string;
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
  metadata: Record<string, unknown>;
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
  const [currentAdminUid, setCurrentAdminUid] = useState<string | null>(null);

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

  // Create Student Modal State
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({
    email: '',
    studentNumber: '',
    fullName: '',
    program: 'BSIT',
    yearLevel: '1',
    section: 'A',
    contactNumber: '',
    temporaryPassword: '',
  });

  // Create Staff Modal State
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({
    email: '',
    fullName: '',
    role: 'librarian' as UserRole,
    contactNumber: '',
    temporaryPassword: '',
    confirmElevatedAdminCreation: false,
  });

  // Action Confirmation Modals (Deactivate / Reactivate / Password Reset)
  const [targetActionUser, setTargetActionUser] = useState<UserRecord | null>(null);
  const [actionType, setActionType] = useState<'deactivate' | 'reactivate' | 'reset_password' | null>(null);

  // One-time Password Result Modal State
  const [oneTimePasswordResult, setOneTimePasswordResult] = useState<{
    email: string;
    fullName: string;
    role: string;
    temporaryPassword: string;
    warning?: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  // Requirement Assignment Modal State
  const [selectedReq, setSelectedReq] = useState<RequirementRecord | null>(null);
  const [signatorySearch, setSignatorySearch] = useState('');
  const [assignedSignatoryId, setAssignedSignatoryId] = useState<string | null>(null);
  const [assignedSignatoryName, setAssignedSignatoryName] = useState<string | null>(null);
  const [reqModalLoading, setReqModalLoading] = useState(false);
  const [reqModalError, setReqModalError] = useState<string | null>(null);
  const [reqModalSuccess, setReqModalSuccess] = useState(false);

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
    } catch (err: unknown) {
      if (isMounted.current) {
        const message = err instanceof Error ? err.message : 'Connection error.';
        console.error('Error loading admin data:', err);
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
    fetch('/api/auth/profile')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted.current && data?.profile?.uid) {
          setCurrentAdminUid(data.profile.uid);
        }
      })
      .catch(() => {});
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle Create Student Account
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await createStudentAccountAction(studentForm);
      if (res.success && res.temporaryPassword && res.user) {
        setShowCreateStudentModal(false);
        setStudentForm({
          email: '',
          studentNumber: '',
          fullName: '',
          program: 'BSIT',
          yearLevel: '1',
          section: 'A',
          contactNumber: '',
          temporaryPassword: '',
        });
        setOneTimePasswordResult({
          email: res.user.email,
          fullName: res.user.fullName,
          role: 'student',
          temporaryPassword: res.temporaryPassword,
        });
        loadData();
      } else {
        setModalError(res.error || 'Failed to create student account.');
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Create student error.');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Create Staff Account
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await createStaffAccountAction(staffForm);
      if (res.success && res.temporaryPassword && res.user) {
        setShowCreateStaffModal(false);
        setStaffForm({
          email: '',
          fullName: '',
          role: 'librarian',
          contactNumber: '',
          temporaryPassword: '',
          confirmElevatedAdminCreation: false,
        });
        setOneTimePasswordResult({
          email: res.user.email,
          fullName: res.user.fullName,
          role: res.user.role,
          temporaryPassword: res.temporaryPassword,
        });
        loadData();
      } else {
        setModalError(res.error || 'Failed to create staff account.');
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Create staff error.');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Account Deactivation
  const handleDeactivate = async () => {
    if (!targetActionUser) return;
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await deactivateUserAccountAction({ userId: targetActionUser.uid });
      if (res.success) {
        setTargetActionUser(null);
        setActionType(null);
        loadData();
      } else {
        setModalError(res.error || 'Deactivation failed.');
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Deactivation error.');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Account Reactivation
  const handleReactivate = async () => {
    if (!targetActionUser) return;
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await reactivateUserAccountAction({ userId: targetActionUser.uid });
      if (res.success) {
        setTargetActionUser(null);
        setActionType(null);
        loadData();
      } else {
        setModalError(res.error || 'Reactivation failed.');
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Reactivation error.');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Temporary Password Reset
  const handleResetPassword = async () => {
    if (!targetActionUser) return;
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await resetUserTemporaryPasswordAction({ userId: targetActionUser.uid });
      if (res.success && 'temporaryPassword' in res) {
        const u = targetActionUser;
        setTargetActionUser(null);
        setActionType(null);
        setOneTimePasswordResult({
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          temporaryPassword: res.temporaryPassword,
          warning: res.warning,
        });
        loadData();
      } else {
        setModalError(res.error || 'Password reset failed.');
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Password reset error.');
    } finally {
      setModalLoading(false);
    }
  };

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
    if (!window.confirm(`Change ${selectedUser.fullName}'s system role to ${selectedRole.replace('_', ' ')}?`)) return;

    setModalLoading(true);
    setModalError(null);
    setModalSuccess(false);

    try {
      const res = await updateUserRoleAction({
        userId: selectedUser.uid,
        newRole: selectedRole,
      });

      if (res?.success) {
        setModalSuccess(true);
        setTimeout(() => {
          setSelectedUser(null);
          loadData();
        }, 800);
      } else {
        setModalError(res?.error || 'Failed to update user role.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection error.';
      setModalError(message);
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
    const target = assignedSignatoryName || 'any signatory with the required role';
    if (!window.confirm(`Assign ${selectedReq.label} to ${target}?`)) return;

    setReqModalLoading(true);
    setReqModalError(null);
    setReqModalSuccess(false);

    try {
      const res = await updateRequirementAssignmentAction({
        requirementId: selectedReq.id,
        assignedSignatoryId,
        assignedSignatoryName,
      });

      if (res?.success) {
        setReqModalSuccess(true);
        setTimeout(() => {
          setSelectedReq(null);
          loadData();
        }, 800);
      } else {
        setReqModalError(res?.error || 'Failed to update requirement assignment.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection error.';
      setReqModalError(message);
    } finally {
      setReqModalLoading(false);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(userSearch.toLowerCase());
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
              Deterministic demo data is managed outside the application: run{' '}
              <code className="font-mono text-xs bg-base-200 px-1.5 py-0.5 rounded">npm run demo:reset</code>{' '}
              against the Firebase Emulator Suite to reset and reseed the fictional fixture dataset.
            </p>
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-base-100 p-4 rounded-2xl border border-base-content/10 shadow-sm">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/50" />
              <input
                type="text"
                placeholder="Search user by name, email, or username..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="input input-sm input-bordered w-full pl-10 bg-base-200 border-base-content/10 rounded-xl text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
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
              <button
                onClick={() => {
                  setModalError(null);
                  setShowCreateStudentModal(true);
                }}
                className="btn btn-sm btn-primary rounded-xl gap-1.5 font-semibold"
              >
                <UserPlus className="w-4 h-4" /> Create Student Account
              </button>
              <button
                onClick={() => {
                  setModalError(null);
                  setShowCreateStaffModal(true);
                }}
                className="btn btn-sm btn-outline rounded-xl gap-1.5 font-semibold"
              >
                <UserPlus className="w-4 h-4" /> Create Staff Account
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto bg-base-100 rounded-2xl border border-base-content/10 shadow-sm">
            <table className="table table-zebra w-full text-sm">
              <thead>
                <tr className="border-b border-base-content/10 bg-base-200/50">
                  <th>User Details</th>
                  <th>Student #</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Password</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-base-content/50 text-xs">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-base-200/40">
                      <td>
                        <div className="font-bold text-base-content">{u.fullName}</div>
                        <div className="text-xs text-base-content/60">{u.email}</div>
                      </td>
                      <td className="font-mono text-xs text-base-content/70">
                        {u.studentNumber || '--'}
                      </td>
                      <td>
                        <span className="badge badge-primary border-primary/20 bg-primary/10 text-primary capitalize font-medium text-xs">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge text-xs capitalize ${
                            u.accountStatus === 'active'
                              ? 'badge-success border-success/20 bg-success/10 text-success'
                              : 'badge-error border-error/20 bg-error/10 text-error'
                          }`}
                        >
                          {u.accountStatus || 'active'}
                        </span>
                      </td>
                      <td>
                        {u.mustChangePassword ? (
                          <span className="badge badge-warning border-warning/20 bg-warning/10 text-warning text-xs font-semibold">
                            Must Change
                          </span>
                        ) : (
                          <span className="badge badge-ghost text-xs text-base-content/60">Normal</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenRoleModal(u)}
                            disabled={u.uid === currentAdminUid}
                            className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1"
                            title="Change User Role"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Role</span>
                          </button>

                          {u.accountStatus === 'inactive' || u.isActive === false ? (
                            <button
                              onClick={() => {
                                setTargetActionUser(u);
                                setActionType('reactivate');
                                setModalError(null);
                              }}
                              className="btn btn-ghost btn-xs text-success hover:bg-success/10 rounded-lg flex items-center gap-1"
                              title="Reactivate Account"
                            >
                              <UserCheck2 className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Reactivate</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setTargetActionUser(u);
                                setActionType('deactivate');
                                setModalError(null);
                              }}
                              disabled={u.uid === currentAdminUid}
                              className="btn btn-ghost btn-xs text-error hover:bg-error/10 rounded-lg flex items-center gap-1"
                              title="Deactivate Account"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Deactivate</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setTargetActionUser(u);
                              setActionType('reset_password');
                              setModalError(null);
                            }}
                            disabled={u.uid === currentAdminUid}
                            className="btn btn-ghost btn-xs text-warning hover:bg-warning/10 rounded-lg flex items-center gap-1"
                            title="Reset Temporary Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Reset Password</span>
                          </button>
                        </div>
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
                <Edit className="w-5 h-5 text-primary" /> Change User Role
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                aria-label="Close modal"
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
                  Change User Role
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
                <UserCheck className="w-5 h-5 text-accent" /> Assign Signatory
              </h3>
              <button
                onClick={() => setSelectedReq(null)}
                aria-label="Close modal"
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
                  Save Signatory Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CREATE STUDENT ACCOUNT MODAL */}
      {showCreateStudentModal && (
        <div className="modal modal-open bg-black/60 backdrop-blur-sm z-50">
          <div className="modal-box bg-base-100 border border-base-content/10 rounded-2xl p-6 max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> Create Student Account
              </h3>
              <button
                onClick={() => setShowCreateStudentModal(false)}
                aria-label="Close modal"
                className="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="label-text text-xs font-semibold">Student Number</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="STUD-2026-0001"
                    value={studentForm.studentNumber}
                    onChange={(e) => setStudentForm({ ...studentForm, studentNumber: e.target.value })}
                    className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="label-text text-xs font-semibold">Full Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Juan Dela Cruz"
                    value={studentForm.fullName}
                    onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                    className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label py-0.5">
                  <span className="label-text text-xs font-semibold">Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="student.a@example.test"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="label-text text-xs font-semibold">Program</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="BSIT"
                    value={studentForm.program}
                    onChange={(e) => setStudentForm({ ...studentForm, program: e.target.value })}
                    className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
                  />
                </div>
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="label-text text-xs font-semibold">Year Level</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="4"
                    value={studentForm.yearLevel}
                    onChange={(e) => setStudentForm({ ...studentForm, yearLevel: e.target.value })}
                    className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
                  />
                </div>
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="label-text text-xs font-semibold">Section</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="A"
                    value={studentForm.section}
                    onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                    className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label py-0.5">
                  <span className="label-text text-xs font-semibold">Custom Temp Password (Optional)</span>
                </label>
                <input
                  type="password"
                  placeholder="Leave empty to auto-generate"
                  value={studentForm.temporaryPassword}
                  onChange={(e) => setStudentForm({ ...studentForm, temporaryPassword: e.target.value })}
                  className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs font-mono"
                />
              </div>

              {modalError && (
                <div className="alert alert-error text-xs rounded-xl py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateStudentModal(false)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="btn btn-sm btn-primary rounded-xl font-semibold gap-1.5"
                >
                  {modalLoading && <span className="loading loading-spinner loading-xs" />}
                  Create Student Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE STAFF ACCOUNT MODAL */}
      {showCreateStaffModal && (
        <div className="modal modal-open bg-black/60 backdrop-blur-sm z-50">
          <div className="modal-box bg-base-100 border border-base-content/10 rounded-2xl p-6 max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-secondary" /> Create Staff Account
              </h3>
              <button
                onClick={() => setShowCreateStaffModal(false)}
                aria-label="Close modal"
                className="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div className="form-control">
                <label className="label py-0.5">
                  <span className="label-text text-xs font-semibold">Full Name</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Maria Clara"
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
                />
              </div>

              <div className="form-control">
                <label className="label py-0.5">
                  <span className="label-text text-xs font-semibold">Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="librarian@example.test"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
                />
              </div>

              <div className="form-control">
                <label className="label py-0.5">
                  <span className="label-text text-xs font-semibold">Staff System Role</span>
                </label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as UserRole })}
                  className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
                >
                  {VALID_STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace('_', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label py-0.5">
                  <span className="label-text text-xs font-semibold">Custom Temp Password (Optional)</span>
                </label>
                <input
                  type="password"
                  placeholder="Leave empty to auto-generate"
                  value={staffForm.temporaryPassword}
                  onChange={(e) => setStaffForm({ ...staffForm, temporaryPassword: e.target.value })}
                  className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs font-mono"
                />
              </div>

              {staffForm.role === 'admin' && (
                <div className="alert alert-warning text-xs rounded-xl py-2 my-2 flex flex-col items-start gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-200">
                    <Shield className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Elevated Privilege Warning</span>
                  </div>
                  <p className="text-[11px] text-amber-300">
                    Creating a System Administrator account grants full access to user management and system settings.
                  </p>
                  <label className="label cursor-pointer p-0 flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={staffForm.confirmElevatedAdminCreation}
                      onChange={(e) => setStaffForm({ ...staffForm, confirmElevatedAdminCreation: e.target.checked })}
                      className="checkbox checkbox-xs checkbox-warning"
                    />
                    <span className="label-text text-xs text-amber-200 font-semibold">
                      I confirm granting full system administrator access.
                    </span>
                  </label>
                </div>
              )}
              {modalError && (
                <div className="alert alert-error text-xs rounded-xl py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="btn btn-sm btn-primary rounded-xl font-semibold gap-1.5"
                >
                  {modalLoading && <span className="loading loading-spinner loading-xs" />}
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION ACTION MODAL (DEACTIVATE / REACTIVATE / RESET PASSWORD) */}
      {targetActionUser && actionType && (
        <div className="modal modal-open bg-black/60 backdrop-blur-sm z-50">
          <div className="modal-box bg-base-100 border border-base-content/10 rounded-2xl p-6 max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2 capitalize">
                {actionType === 'deactivate' && <UserX className="w-5 h-5 text-error" />}
                {actionType === 'reactivate' && <UserCheck2 className="w-5 h-5 text-success" />}
                {actionType === 'reset_password' && <KeyRound className="w-5 h-5 text-warning" />}
                <span>{actionType.replace('_', ' ')} Account</span>
              </h3>
              <button
                onClick={() => {
                  setTargetActionUser(null);
                  setActionType(null);
                }}
                aria-label="Close modal"
                className="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-base-200/50 p-3 rounded-xl border border-base-content/10 text-xs space-y-1">
                <div>
                  <span className="text-base-content/60">Target User: </span>
                  <span className="font-bold text-base-content">{targetActionUser.fullName}</span>
                </div>
                <div>
                  <span className="text-base-content/60">Email: </span>
                  <span className="font-mono text-base-content/80">{targetActionUser.email}</span>
                </div>
              </div>

              <p className="text-xs text-base-content/70">
                {actionType === 'deactivate' &&
                  'Deactivating this account will disable authentication sign-in and revoke active sessions immediately.'}
                {actionType === 'reactivate' &&
                  'Reactivating this account will enable authentication sign-in for the user again.'}
                {actionType === 'reset_password' &&
                  'Resetting will generate a new temporary password, revoke existing active sessions, and mandate a password change on next sign-in.'}
              </p>

              {modalError && (
                <div className="alert alert-error text-xs rounded-xl py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetActionUser(null);
                    setActionType(null);
                  }}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={
                    actionType === 'deactivate'
                      ? handleDeactivate
                      : actionType === 'reactivate'
                      ? handleReactivate
                      : handleResetPassword
                  }
                  disabled={modalLoading}
                  className={`btn btn-sm rounded-xl font-semibold gap-1.5 ${
                    actionType === 'deactivate'
                      ? 'btn-error'
                      : actionType === 'reactivate'
                      ? 'btn-success'
                      : 'btn-warning'
                  }`}
                >
                  {modalLoading && <span className="loading loading-spinner loading-xs" />}
                  Confirm {actionType.replace('_', ' ')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONE-TIME TEMPORARY PASSWORD DISPLAY MODAL */}
      {oneTimePasswordResult && (
        <div className="modal modal-open bg-black/60 backdrop-blur-sm z-50">
          <div className="modal-box bg-base-100 border border-base-content/10 rounded-2xl p-6 max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
              <h3 className="font-bold text-lg text-success flex items-center gap-2">
                <KeyRound className="w-5 h-5" /> Account Credentials Issued
              </h3>
              <button
                onClick={() => {
                  setOneTimePasswordResult(null);
                  setCopiedPassword(false);
                }}
                aria-label="Close modal"
                className="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-warning/10 border border-warning/30 p-3 rounded-xl text-xs text-warning-content space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-warning" /> One-Time Password Notice
              </div>
              <p className="text-[11px] opacity-90">
                Store this temporary password securely. It is <strong>NOT</strong> saved in Firestore or logs and will <strong>NOT</strong> be displayed again.
              </p>
            </div>

            {oneTimePasswordResult.warning && (
              <div className="alert alert-warning text-xs rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
                <span>{oneTimePasswordResult.warning}</span>
              </div>
            )}

            <div className="bg-base-200 p-4 rounded-xl space-y-2 text-xs">
              <div>
                <span className="text-base-content/60 font-medium">Full Name:</span>{' '}
                <span className="font-bold text-base-content">{oneTimePasswordResult.fullName}</span>
              </div>
              <div>
                <span className="text-base-content/60 font-medium">Email:</span>{' '}
                <span className="font-mono text-base-content">{oneTimePasswordResult.email}</span>
              </div>
              <div>
                <span className="text-base-content/60 font-medium">Role:</span>{' '}
                <span className="capitalize font-semibold text-primary">{oneTimePasswordResult.role.replace('_', ' ')}</span>
              </div>
              <div className="pt-2 border-t border-base-content/10 flex items-center justify-between">
                <div>
                  <span className="text-base-content/60 font-medium block text-[10px]">TEMPORARY PASSWORD</span>
                  <span className="font-mono font-black text-sm text-primary">{oneTimePasswordResult.temporaryPassword}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(oneTimePasswordResult.temporaryPassword);
                    setCopiedPassword(true);
                    setTimeout(() => setCopiedPassword(false), 2000);
                  }}
                  className="btn btn-xs btn-outline rounded-lg gap-1"
                >
                  {copiedPassword ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPassword ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOneTimePasswordResult(null);
                setCopiedPassword(false);
              }}
              className="btn btn-primary btn-sm w-full rounded-xl font-semibold"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
