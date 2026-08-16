'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  fetchAdminUsersAction,
  updateUserRoleAction,
  fetchClearanceRequirementsAction,
  fetchSignatoryCandidatesAction,
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
import { ACADEMIC_PROGRAM_CODES, ACADEMIC_PROGRAMS, formatProgram } from '@/lib/academic-programs';
import {
  Users,
  Shield,
  FileCheck,
  Activity,
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
import AccessibleDialog from '@/components/ui/AccessibleDialog';
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
  program?: string;
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
    program: 'BSAIS',
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
  const [signatoryCandidates, setSignatoryCandidates] = useState<UserRecord[]>([]);

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
          program: 'BSAIS',
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
        await loadData();
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
        await loadData();
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

  useEffect(() => {
    let cancelled = false;
    if (!selectedReq) {
      setSignatoryCandidates([]);
      return;
    }
    fetchSignatoryCandidatesAction(selectedReq.role).then((res) => {
      if (!cancelled) {
        setSignatoryCandidates(res.success ? (res.candidates as UserRecord[]) : []);
      }
    }).catch(() => {
      if (!cancelled) setSignatoryCandidates([]);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedReq]);

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
  const eligibleSignatories = signatoryCandidates.filter(
    (u) =>
      (u.fullName.toLowerCase().includes(signatorySearch.toLowerCase()) ||
        u.email.toLowerCase().includes(signatorySearch.toLowerCase()))
  );

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-100 p-6 rounded-xl border border-base-content/15 shadow-sm">
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
            className="btn btn-sm min-h-11 btn-ghost border border-base-content/25 text-base-content hover:bg-base-200 font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs tabs-boxed bg-base-100 p-1.5 rounded-xl border border-base-content/15 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`tab gap-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'overview' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70'
          }`}
        >
          <Activity className="w-4 h-4" /> Overview
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`tab gap-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'users' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70'
          }`}
        >
          <Users className="w-4 h-4" /> Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('requirements')}
          className={`tab gap-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'requirements' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70'
          }`}
        >
          <ListOrdered className="w-4 h-4" /> Requirements ({requirements.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`tab gap-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'logs' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70'
          }`}
        >
          <FileCheck className="w-4 h-4" /> Audit Logs ({logs.length})
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error rounded-xl shadow-sm border border-error/30 flex items-center justify-between">
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
            <div className="stat bg-base-100 border border-base-content/15 rounded-xl shadow-sm">
              <div className="stat-figure text-primary">
                <Users className="w-8 h-8 opacity-80" />
              </div>
              <div className="stat-title text-xs font-semibold uppercase tracking-wider">Total System Users</div>
              <div className="stat-value text-3xl font-black text-primary">{users.length}</div>
              <div className="stat-desc text-xs mt-1">Across 9 role types</div>
            </div>

            <div className="stat bg-base-100 border border-base-content/15 rounded-xl shadow-sm">
              <div className="stat-figure text-secondary">
                <UserCheck className="w-8 h-8 opacity-80" />
              </div>
              <div className="stat-title text-xs font-semibold uppercase tracking-wider">Active Students</div>
              <div className="stat-value text-3xl font-black text-secondary">
                {users.filter((u) => u.role === 'student').length}
              </div>
              <div className="stat-desc text-xs mt-1">Registered accounts</div>
            </div>

            <div className="stat bg-base-100 border border-base-content/15 rounded-xl shadow-sm">
              <div className="stat-figure text-accent">
                <ListOrdered className="w-8 h-8 opacity-80" />
              </div>
              <div className="stat-title text-xs font-semibold uppercase tracking-wider">Clearance Steps</div>
              <div className="stat-value text-3xl font-black text-accent">{requirements.length}</div>
              <div className="stat-desc text-xs mt-1">Department sign-offs</div>
            </div>

            <div className="stat bg-base-100 border border-base-content/15 rounded-xl shadow-sm">
              <div className="stat-figure text-info">
                <Activity className="w-8 h-8 opacity-80" />
              </div>
              <div className="stat-title text-xs font-semibold uppercase tracking-wider">Audit Log Items</div>
              <div className="stat-value text-3xl font-black text-info">{logs.length}</div>
              <div className="stat-desc text-xs mt-1">Recent system activities</div>
            </div>
          </div>

        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-base-100 p-4 rounded-xl border border-base-content/15 shadow-sm">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/50" />
              <input
                type="text"
                placeholder="Search user by name, email, or username..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="input input-sm h-11 input-bordered w-full pl-10 bg-base-200 border-base-content/15 rounded-xl text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <select
                id="admin-user-role-filter"
                aria-label="Filter Users by Role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="select select-sm min-h-11 select-bordered bg-base-200 border-base-content/15 rounded-xl text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                className="btn btn-sm min-h-11 btn-primary rounded-xl gap-1.5 font-semibold"
              >
                <UserPlus className="w-4 h-4" /> Create Student Account
              </button>
              <button
                onClick={() => {
                  setModalError(null);
                  setShowCreateStaffModal(true);
                }}
                className="btn btn-sm min-h-11 btn-outline rounded-xl gap-1.5 font-semibold"
              >
                <UserPlus className="w-4 h-4" /> Create Staff Account
              </button>
            </div>
          </div>

          {/* Users Table */}
          <p className="sm:hidden mb-2 text-xs text-base-content/60">Swipe horizontally to view all columns.</p>
          <div className="overflow-x-auto bg-base-100 rounded-xl border border-base-content/15 shadow-sm">
            <table className="table table-zebra w-full text-sm">
              <thead>
                <tr className="border-b border-base-content/15 bg-base-200/50">
                  <th>User Details</th>
                  <th>Student #</th>
                  <th>Program</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Password</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-base-content/60 text-xs">
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
                      <td className="text-xs text-base-content/80">
                        {u.role === 'student' ? formatProgram(u.program) : '--'}
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
                            className="btn btn-xs btn-primary text-primary-content font-bold rounded-lg flex items-center gap-1"
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
                              className="btn btn-xs btn-success text-success-content font-bold rounded-lg flex items-center gap-1"
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
                              className="btn btn-xs btn-error text-error-content font-bold rounded-lg flex items-center gap-1"
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
                            className="btn btn-xs btn-warning text-warning-content font-bold rounded-lg flex items-center gap-1"
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
          <div className="bg-base-100 p-4 rounded-xl border border-base-content/15 shadow-sm">
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
                className="card bg-base-100 border border-base-content/15 shadow-sm rounded-xl p-5 space-y-3"
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
                    className="btn btn-sm min-h-11 btn-outline rounded-lg gap-1 hover:bg-base-200"
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
          <p className="sm:hidden mb-2 text-xs text-base-content/60">Swipe horizontally to view all columns.</p>
          <div className="overflow-x-auto bg-base-100 rounded-xl border border-base-content/15 shadow-sm">
            <table className="table table-zebra w-full text-xs">
              <thead>
                <tr className="border-b border-base-content/15 bg-base-200/50">
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
      <AccessibleDialog
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Change User Role"
        description="Update role privileges and permissions for the selected user account."
        preventClose={modalLoading}
        maxWidthClass="max-w-md"
      >
        {selectedUser && (
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
              <label htmlFor="select-new-role" className="label py-1">
                <span className="label-text text-xs font-semibold">Select New System Role</span>
              </label>
              <select
                id="select-new-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="select select-bordered w-full bg-base-200 border-base-content/10 rounded-xl text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {selectedUser.role === 'adviser' && (
                  <option value="adviser" disabled>
                    Legacy Adviser (read-only)
                  </option>
                )}
                {ROLES_LIST.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {modalError && (
              <div role="alert" className="alert alert-error text-error-content text-xs rounded-xl py-2 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div role="status" aria-live="polite" className="alert alert-success text-success-content text-xs rounded-xl py-2 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>User role updated successfully!</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-base-content/10">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="btn btn-sm btn-ghost rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalLoading || modalSuccess}
                aria-busy={modalLoading}
                className="btn btn-sm btn-primary rounded-xl font-semibold gap-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {modalLoading ? 'Changing Role...' : 'Change User Role'}
              </button>
            </div>
          </form>
        )}
      </AccessibleDialog>

      {/* ASSIGN SIGNATORY MODAL */}
      {selectedReq && (
        <div className="modal modal-open bg-black/60 backdrop-blur-sm z-50">
          <div className="modal-box bg-base-100 border border-base-content/15 rounded-xl p-6 max-w-md shadow-sm">
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
      <AccessibleDialog
        isOpen={showCreateStudentModal}
        onClose={() => setShowCreateStudentModal(false)}
        title="Create Student Account"
        description="Register a new student account in Auth and Firestore with synchronized profile attributes."
        preventClose={modalLoading}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateStudent} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-control">
              <label htmlFor="create-student-number" className="label py-0.5">
                <span className="label-text text-xs font-semibold">Student Number</span>
              </label>
              <input
                id="create-student-number"
                type="text"
                required
                placeholder="STUD-2026-0001"
                value={studentForm.studentNumber}
                onChange={(e) => setStudentForm({ ...studentForm, studentNumber: e.target.value })}
                className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="form-control">
              <label htmlFor="create-student-fullname" className="label py-0.5">
                <span className="label-text text-xs font-semibold">Full Name</span>
              </label>
              <input
                id="create-student-fullname"
                type="text"
                required
                placeholder="Juan Dela Cruz"
                value={studentForm.fullName}
                onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>

          <div className="form-control">
            <label htmlFor="create-student-email" className="label py-0.5">
              <span className="label-text text-xs font-semibold">Email Address</span>
            </label>
            <input
              id="create-student-email"
              type="email"
              required
              placeholder="name@example.com"
              value={studentForm.email}
              onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
              className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="form-control">
              <label htmlFor="create-student-program" className="label py-0.5">
                <span className="label-text text-xs font-semibold">Program</span>
              </label>
              <select
                id="create-student-program"
                required
                value={studentForm.program}
                onChange={(e) => setStudentForm({ ...studentForm, program: e.target.value })}
                className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {ACADEMIC_PROGRAM_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code} — {ACADEMIC_PROGRAMS[code]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label htmlFor="create-student-year" className="label py-0.5">
                <span className="label-text text-xs font-semibold">Year Level</span>
              </label>
              <input
                id="create-student-year"
                type="text"
                required
                placeholder="4"
                value={studentForm.yearLevel}
                onChange={(e) => setStudentForm({ ...studentForm, yearLevel: e.target.value })}
                className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="form-control">
              <label htmlFor="create-student-section" className="label py-0.5">
                <span className="label-text text-xs font-semibold">Section</span>
              </label>
              <input
                id="create-student-section"
                type="text"
                required
                placeholder="A"
                value={studentForm.section}
                onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>

          <div className="form-control">
            <label htmlFor="create-student-temppass" className="label py-0.5">
              <span className="label-text text-xs font-semibold">Custom Temp Password (Optional)</span>
            </label>
            <input
              id="create-student-temppass"
              type="password"
              placeholder="Leave empty to auto-generate"
              value={studentForm.temporaryPassword}
              onChange={(e) => setStudentForm({ ...studentForm, temporaryPassword: e.target.value })}
              className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {modalError && (
            <div role="alert" className="alert alert-error text-error-content text-xs rounded-xl py-2 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-base-content/10">
            <button
              type="button"
              onClick={() => setShowCreateStudentModal(false)}
              className="btn btn-sm btn-ghost rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalLoading}
              aria-busy={modalLoading}
              className="btn btn-sm btn-primary text-primary-content rounded-xl font-semibold gap-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {modalLoading ? 'Creating Student Account...' : 'Create Student Account'}
            </button>
          </div>
        </form>
      </AccessibleDialog>

      {/* CREATE STAFF ACCOUNT MODAL */}
      <AccessibleDialog
        isOpen={showCreateStaffModal}
        onClose={() => setShowCreateStaffModal(false)}
        title="Create Staff Account"
        description="Register a department staff or administrator account in Auth."
        preventClose={modalLoading}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreateStaff} className="space-y-3">
          <div className="form-control">
            <label htmlFor="create-staff-fullname" className="label py-0.5">
              <span className="label-text text-xs font-semibold">Full Name</span>
            </label>
            <input
              id="create-staff-fullname"
              type="text"
              required
              placeholder="Maria Clara"
              value={staffForm.fullName}
              onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
              className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="form-control">
            <label htmlFor="create-staff-email" className="label py-0.5">
              <span className="label-text text-xs font-semibold">Email Address</span>
            </label>
            <input
              id="create-staff-email"
              type="email"
              required
              placeholder="name@example.com"
              value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="form-control">
            <label htmlFor="create-staff-role" className="label py-0.5">
              <span className="label-text text-xs font-semibold">Staff System Role</span>
            </label>
            <select
              id="create-staff-role"
              value={staffForm.role}
              onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as UserRole })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {VALID_STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label htmlFor="create-staff-temppass" className="label py-0.5">
              <span className="label-text text-xs font-semibold">Custom Temp Password (Optional)</span>
            </label>
            <input
              id="create-staff-temppass"
              type="password"
              placeholder="Leave empty to auto-generate"
              value={staffForm.temporaryPassword}
              onChange={(e) => setStaffForm({ ...staffForm, temporaryPassword: e.target.value })}
              className="input input-sm input-bordered bg-base-200 border-base-content/10 rounded-xl text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {staffForm.role === 'admin' && (
            <div role="alert" className="alert alert-warning text-warning-content text-xs rounded-xl py-2 my-2 flex flex-col items-start gap-2 font-medium">
              <div className="flex items-center gap-2 font-bold">
                <Shield className="w-4 h-4 shrink-0 text-warning" aria-hidden="true" />
                <span>Elevated Privilege Warning</span>
              </div>
              <p className="text-[11px] opacity-90">
                Creating a System Administrator account grants full access to user management and system settings.
              </p>
              <label className="label cursor-pointer p-0 flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  checked={staffForm.confirmElevatedAdminCreation}
                  onChange={(e) => setStaffForm({ ...staffForm, confirmElevatedAdminCreation: e.target.checked })}
                  className="checkbox checkbox-xs checkbox-warning"
                />
                <span className="label-text text-xs text-warning-content font-semibold">
                  I confirm granting full system administrator access.
                </span>
              </label>
            </div>
          )}
          {modalError && (
            <div role="alert" className="alert alert-error text-error-content text-xs rounded-xl py-2 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-base-content/10">
            <button
              type="button"
              onClick={() => setShowCreateStaffModal(false)}
              className="btn btn-sm btn-ghost rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalLoading}
              aria-busy={modalLoading}
              className="btn btn-sm btn-primary text-primary-content rounded-xl font-semibold gap-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {modalLoading ? 'Creating Staff Account...' : 'Create Staff Account'}
            </button>
          </div>
        </form>
      </AccessibleDialog>

      {/* CONFIRMATION ACTION MODAL (DEACTIVATE / REACTIVATE / RESET PASSWORD) */}
      <AccessibleDialog
        isOpen={!!targetActionUser && !!actionType}
        onClose={() => {
          setTargetActionUser(null);
          setActionType(null);
        }}
        title={`${actionType ? actionType.replace('_', ' ') : ''} Account Confirmation`}
        description="Please review and confirm this account management action."
        preventClose={modalLoading}
        maxWidthClass="max-w-md"
      >
        {targetActionUser && actionType && (
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

            <p className="text-xs text-base-content/70 font-medium">
              {actionType === 'deactivate' &&
                'Deactivating this account will disable authentication sign-in and revoke active sessions immediately.'}
              {actionType === 'reactivate' &&
                'Reactivating this account will enable authentication sign-in for the user again.'}
              {actionType === 'reset_password' &&
                'Resetting will generate a new temporary password, revoke existing active sessions, and mandate a password change on next sign-in.'}
            </p>

            {modalError && (
              <div role="alert" className="alert alert-error text-error-content text-xs rounded-xl py-2 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-base-content/10">
              <button
                type="button"
                onClick={() => {
                  setTargetActionUser(null);
                  setActionType(null);
                }}
                className="btn btn-sm btn-ghost rounded-xl text-xs"
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
                aria-busy={modalLoading}
                className={`btn btn-sm rounded-xl font-semibold gap-1.5 text-xs ${
                  actionType === 'deactivate'
                    ? 'btn-error text-error-content'
                    : actionType === 'reactivate'
                    ? 'btn-success text-success-content'
                    : 'btn-warning text-warning-content'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
              >
                {modalLoading ? 'Processing...' : `Confirm ${actionType.replace('_', ' ')}`}
              </button>
            </div>
          </div>
        )}
      </AccessibleDialog>

      {/* ONE-TIME TEMPORARY PASSWORD DISPLAY MODAL */}
      <AccessibleDialog
        isOpen={!!oneTimePasswordResult}
        onClose={() => {
          setOneTimePasswordResult(null);
          setCopiedPassword(false);
        }}
        title="Account Credentials Issued"
        description="One-time temporary credentials generated for account sign-in."
        maxWidthClass="max-w-md"
      >
        {oneTimePasswordResult && (
          <div className="space-y-4">
            <div role="status" aria-live="polite" className="bg-warning/10 border border-warning/30 p-3 rounded-xl text-xs text-warning-content space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-warning" aria-hidden="true" />
                <span>One-Time Password Notice</span>
              </div>
              <p className="text-[11px] opacity-90">
                Store this temporary password securely. It is <strong>NOT</strong> saved in Firestore or logs and will <strong>NOT</strong> be displayed again.
              </p>
            </div>

            {oneTimePasswordResult.warning && (
              <div role="alert" className="alert alert-warning text-warning-content text-xs rounded-xl p-3 flex items-start gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
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
                  className="btn btn-xs btn-outline rounded-lg gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {copiedPassword ? <Check className="w-3.5 h-3.5 text-success" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                  <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOneTimePasswordResult(null);
                setCopiedPassword(false);
              }}
              className="btn btn-primary btn-sm w-full rounded-xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Done & Close
            </button>
          </div>
        )}
      </AccessibleDialog>
    </div>
  );
}
