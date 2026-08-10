'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { getPasswordChangeRecovery } from '@/lib/auth/password-transition';
import { Lock, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import ThemeSelector from '@/components/ui/ThemeSelector';
import PasswordInput from '@/components/auth/PasswordInput';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validation and Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const recovery = getPasswordChangeRecovery(res.ok, data);

      if (recovery.clearFields) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      if (recovery.signOut) {
        await signOut(firebaseAuth).catch(() => {});
      }

      if (!res.ok) {
        if (recovery.redirectTo) {
          setError(
            recovery.message ||
              'Your password changed, but account synchronization is incomplete. Sign in using the new password.'
          );
          setTimeout(() => {
            router.replace(recovery.redirectTo!);
            router.refresh();
          }, 2500);
          return;
        }

        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update password.');
      }

      setSuccess(true);

      setTimeout(() => {
        router.replace('/login');
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      console.error('Password change error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to change password. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-300 text-base-content flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-200">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Theme Switcher Header */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeSelector />
      </div>

      <main id="main-content" className="w-full max-w-md space-y-6 z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-7 h-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-base-content">
            Mandatory Password Change
          </h1>
          <p className="text-xs text-base-content/70 font-medium">
            Your account is set to require a password change before accessing the system.
          </p>
        </div>

        {/* Form Card */}
        <div className="card bg-base-100 border border-base-content/15 p-6 sm:p-8 rounded-xl shadow-sm space-y-6">
          {error && (
            <div role="alert" className="alert alert-error text-error-content text-xs rounded-xl flex items-start gap-2.5 p-3 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div role="status" aria-live="polite" className="alert alert-success text-success-content text-xs rounded-xl flex items-center gap-2.5 p-3 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Password updated successfully. Redirecting to sign in…</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Temporary Password */}
            <div className="form-control space-y-1">
              <label htmlFor="currentPassword" className="label py-0">
                <span className="label-text text-base-content/80 text-xs font-semibold">
                  Current Temporary Password
                </span>
              </label>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading || success}
                autoComplete="current-password"
                placeholder="••••••••"
                leadingIcon={<Lock className="w-4 h-4" aria-hidden="true" />}
                className="input input-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl placeholder-base-content/40 text-sm h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            {/* New Password */}
            <div className="form-control space-y-1">
              <label htmlFor="newPassword" className="label py-0">
                <span className="label-text text-base-content/80 text-xs font-semibold">
                  New Password (min. 8 chars)
                </span>
              </label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading || success}
                autoComplete="new-password"
                placeholder="••••••••"
                leadingIcon={<Lock className="w-4 h-4" aria-hidden="true" />}
                className="input input-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl placeholder-base-content/40 text-sm h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            {/* Confirm New Password */}
            <div className="form-control space-y-1">
              <label htmlFor="confirmPassword" className="label py-0">
                <span className="label-text text-base-content/80 text-xs font-semibold">
                  Confirm New Password
                </span>
              </label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || success}
                autoComplete="new-password"
                placeholder="••••••••"
                leadingIcon={<Lock className="w-4 h-4" aria-hidden="true" />}
                className="input input-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl placeholder-base-content/40 text-sm h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              aria-busy={loading}
              className="btn btn-primary w-full rounded-xl font-semibold tracking-wide shadow-lg h-11 text-xs uppercase mt-4 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Update Password</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
