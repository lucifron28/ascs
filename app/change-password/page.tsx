'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { completeMandatoryPasswordChangeAction } from '@/app/actions/admin-accounts';
import { Lock, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import ThemeSelector from '@/components/ui/ThemeSelector';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Confirm Firebase Auth client user is signed in
    const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const user = firebaseAuth.currentUser;
    if (!user || !user.email) {
      setError('No active session found. Please log in again.');
      router.push('/login');
      return;
    }

    if (!currentPassword) {
      setError('Please enter your current temporary password.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current temporary password.');
      return;
    }

    setLoading(true);

    try {
      // 1. Reauthenticate with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Update Auth password on client Firebase SDK
      await updatePassword(user, newPassword);

      // 3. Clear mustChangePassword flag via trusted server action
      const res = await completeMandatoryPasswordChangeAction();
      if (!res.success) {
        throw new Error(res.error || 'Failed to update account password flag.');
      }

      setSuccess(true);

      // 4. Fetch profile to determine role dashboard
      const profileRes = await fetch('/api/auth/profile');
      const profileData = await profileRes.json();
      const role = profileData?.profile?.role || 'student';

      setTimeout(() => {
        router.push(`/${role}/dashboard`);
        router.refresh();
      }, 1200);
    } catch (err: unknown) {
      console.error('Password change error:', err);
      const errObj = err as { code?: string; message?: string };
      let msg = 'Failed to change password. Please check your current password.';
      if (errObj.code === 'auth/wrong-password' || errObj.code === 'auth/invalid-credential') {
        msg = 'Incorrect current temporary password.';
      } else if (errObj.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please choose a stronger password.';
      } else if (errObj.message) {
        msg = errObj.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Theme Switcher Header */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeSelector />
      </div>

      <div className="w-full max-w-md space-y-6 z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-indigo-950/60 border border-indigo-800/40 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-950/40">
            <Lock className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Mandatory Password Change
          </h1>
          <p className="text-xs text-slate-400">
            Your account is set to require a password change before accessing the system.
          </p>
        </div>

        {/* Form Card */}
        <div className="card bg-slate-900/60 border border-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6">
          {error && (
            <div className="alert alert-error bg-rose-950/80 border-rose-800 text-rose-300 text-xs rounded-xl flex items-start gap-2.5 p-3">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success bg-emerald-950/80 border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2.5 p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password updated successfully! Redirecting to your dashboard...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Temporary Password */}
            <div className="form-control space-y-1">
              <label className="label py-0">
                <span className="label-text text-slate-300 text-xs font-semibold">
                  Current Temporary Password
                </span>
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading || success}
                placeholder="••••••••"
                className="input input-bordered w-full bg-slate-950/50 border-slate-800 focus:border-indigo-500 text-white rounded-xl placeholder-slate-700 text-sm"
              />
            </div>

            {/* New Password */}
            <div className="form-control space-y-1">
              <label className="label py-0">
                <span className="label-text text-slate-300 text-xs font-semibold">
                  New Password (min. 8 chars)
                </span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading || success}
                placeholder="••••••••"
                className="input input-bordered w-full bg-slate-950/50 border-slate-800 focus:border-indigo-500 text-white rounded-xl placeholder-slate-700 text-sm"
              />
            </div>

            {/* Confirm New Password */}
            <div className="form-control space-y-1">
              <label className="label py-0">
                <span className="label-text text-slate-300 text-xs font-semibold">
                  Confirm New Password
                </span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || success}
                placeholder="••••••••"
                className="input input-bordered w-full bg-slate-950/50 border-slate-800 focus:border-indigo-500 text-white rounded-xl placeholder-slate-700 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="btn btn-primary w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-none text-white rounded-xl font-semibold tracking-wide shadow-lg shadow-indigo-950/40 h-11 text-xs uppercase mt-4 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  <span>Update Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
