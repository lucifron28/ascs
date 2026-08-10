'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from '@tanstack/react-form';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth as auth } from '@/lib/firebase/client';
import { LogIn, Mail, Lock, ShieldAlert, Check } from 'lucide-react';
import ThemeSelector from '@/components/ui/ThemeSelector';
import {
  DEMO_ACCOUNT_DEFINITIONS,
  DEMO_ACCOUNT_GROUPS,
  getDemoAccountById,
  shouldShowDemoAccountPicker,
} from '@/lib/demo/demo-accounts';
import { formatProgram } from '@/lib/academic-programs';

const EMULATOR_DEMO_PASSWORD = 'password123';

async function readJsonResponse(response: Response) {
  const body = await response.text();
  if (!body) return {};

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error(`Authentication service returned an invalid response (HTTP ${response.status}).`);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const useFirebaseEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
  const showDemoAccountPicker = shouldShowDemoAccountPicker(demoMode, useFirebaseEmulator);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedDemoAccountId, setSelectedDemoAccountId] = useState('');
  const selectedDemoAccount = getDemoAccountById(selectedDemoAccountId);

  // TanStack Form configuration
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        // Seeding is an explicit prerequisite (npm run demo:reset). The emulator
        // dataset is deterministic; the login flow never mutates demo accounts.

        // 1. Authenticate with Firebase Auth Client SDK
        const userCredential = await signInWithEmailAndPassword(
          auth,
          value.email,
          value.password
        );

        // 2. Fetch the ID token
        const idToken = await userCredential.user.getIdToken();

        // 3. Post to local Route Handler to set secure session cookie
        const sessionRes = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        if (!sessionRes.ok) {
          const sessionBody = await readJsonResponse(sessionRes);
          throw new Error(typeof sessionBody.error === 'string' ? sessionBody.error : 'Failed to establish session.');
        }

        // 4. Fetch the profile details to determine the user role
        const profileRes = await fetch('/api/auth/profile');
        const profileBody = await readJsonResponse(profileRes);
        if (!profileRes.ok) {
          throw new Error(typeof profileBody.error === 'string' ? profileBody.error : 'Failed to retrieve profile details.');
        }

        const { profile } = profileBody as {
          profile?: { role?: string; mustChangePassword?: boolean; accountStatus?: string; isActive?: boolean };
        };
        if (!profile) {
          throw new Error('Profile not found. Contact the system administrator.');
        }
        const role = profile.role || 'student';
        const mustChangePassword = profile.mustChangePassword === true;

        setSuccess(true);

        // 5. Short timeout for smooth visual transition
        setTimeout(() => {
          if (mustChangePassword) {
            router.push('/change-password');
          } else {
            router.push(`/${role}/dashboard`);
          }
          router.refresh();
        }, 1000);
      } catch (err: unknown) {
        console.error('Login error:', err);
        const errObj = err as { code?: string; message?: string };
        let friendlyMessage = 'Authentication failed. Please check your credentials.';
        if (errObj.code === 'auth/invalid-credential' || errObj.code === 'auth/user-not-found' || errObj.code === 'auth/wrong-password') {
          friendlyMessage = 'Invalid email or password.';
        } else if (errObj.code === 'auth/network-request-failed') {
          friendlyMessage = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
            ? 'Firebase Auth emulator is unavailable. Start `firebase emulators:start` and try again.'
            : 'Network error. Please check your connection.';
        } else if (errObj.message) {
          friendlyMessage = errObj.message;
        }
        setError(friendlyMessage);
        setLoading(false);
      }
    },
  });

  const fillDemoCredentials = () => {
    if (!selectedDemoAccount) {
      setError('Select a demo account before filling credentials.');
      return;
    }

    form.setFieldValue('email', selectedDemoAccount.email);
    form.setFieldValue('password', EMULATOR_DEMO_PASSWORD);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden flex items-center justify-center bg-base-300 text-base-content font-sans transition-colors duration-200">
      {/* Theme Selector Floating Menu */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeSelector />
      </div>

      {/* Main Content Area */}
      <main id="main-content" className="relative w-full max-w-md p-4 z-10">
        {/* Title / Logo Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <Image
            src="/pkmlogo.png"
            alt="Pamantasan ng Kolehiyo ng Mauban seal"
            width={96}
            height={96}
            preload
            className="h-20 w-20 object-contain mb-3"
          />
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">
            ASCS PKM
          </h1>
          <p className="text-base-content/70 text-sm mt-2 font-medium">
            Automated Student Clearance & Financial Monitoring
          </p>
        </div>

        {/* Login Card */}
        <div className="card w-full bg-base-100 border border-base-content/15 shadow-lg p-8 rounded-2xl">
          <h2 className="text-xl font-bold text-base-content mb-6 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-primary" /> Sign In
          </h2>

          {/* Success Notification Alert */}
          {success && (
            <div role="status" aria-live="polite" className="alert alert-success text-success-content rounded-xl mb-6 flex items-center gap-2 p-3 text-sm font-medium">
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Login successful! Redirecting to dashboard...</span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div role="alert" className="alert alert-error text-error-content rounded-xl mb-6 flex items-center gap-2 p-3 text-sm font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-5"
          >
            {/* Email Field */}
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Email is required';
                  if (!/\S+@\S+\.\S+/.test(value)) return 'Invalid email format';
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="form-control w-full">
                  <label htmlFor="email" className="label py-1">
                    <span className="label-text text-base-content/80 font-medium text-xs">Email Address</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/50">
                      <Mail className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={loading || success}
                      autoComplete="username"
                      aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
                      aria-describedby={field.state.meta.isTouched && field.state.meta.errors.length > 0 ? 'email-error' : undefined}
                      placeholder="name@example.com"
                      className="input input-bordered w-full pl-10 bg-base-200 border-base-content/15 text-base-content rounded-xl placeholder-base-content/40 text-sm h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <p id="email-error" className="text-error text-xs mt-1.5 font-medium">
                      {field.state.meta.errors.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Password Field */}
            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Password is required';
                  if (value.length < 6) return 'Password must be at least 6 characters';
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="form-control w-full">
                  <label htmlFor="password" className="label py-1">
                    <span className="label-text text-base-content/80 font-medium text-xs">Password</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/50">
                      <Lock className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={loading || success}
                      autoComplete="current-password"
                      aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
                      aria-describedby={field.state.meta.isTouched && field.state.meta.errors.length > 0 ? 'password-error' : undefined}
                      placeholder="••••••••"
                      className="input input-bordered w-full pl-10 bg-base-200 border-base-content/15 text-base-content rounded-xl placeholder-base-content/40 text-sm h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <p id="password-error" className="text-error text-xs mt-1.5 font-medium">
                      {field.state.meta.errors.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              aria-busy={loading}
              className="btn btn-primary w-full rounded-xl shadow-sm mt-6 flex items-center justify-center gap-2 min-h-12 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>Log In</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo Credential Picker (local emulator only; never shown on the public demo) */}
        {showDemoAccountPicker && (
          <div className="card w-full mt-6 bg-base-100 border border-base-content/15 p-5 rounded-2xl shadow-sm">
            <h3 className="text-xs font-bold text-base-content/70 mb-3 uppercase tracking-wider">
              Demo / Emulator Only — Fictional Data
            </h3>
            <div className="form-control">
              <label htmlFor="demo-account" className="label py-1">
                <span className="label-text text-base-content/80 font-semibold text-xs">Demo account</span>
              </label>
              <select
                id="demo-account"
                value={selectedDemoAccountId}
                onChange={(event) => {
                  setSelectedDemoAccountId(event.target.value);
                  setError(null);
                }}
                disabled={loading || success}
                aria-describedby={selectedDemoAccount ? 'demo-account-details' : undefined}
                className="select select-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl text-sm min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">Select a demo account...</option>
                {DEMO_ACCOUNT_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {DEMO_ACCOUNT_DEFINITIONS
                      .filter((account) => account.group === group)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {selectedDemoAccount && (
              <div id="demo-account-details" className="mt-4 rounded-xl border border-base-content/10 bg-base-200/60 p-3 text-xs">
                <p className="font-bold text-base-content mb-2">Selected account information</p>
                <dl className="space-y-1.5">
                  <div className="flex gap-2">
                    <dt className="font-semibold text-base-content/60 min-w-24">Role / Scenario</dt>
                    <dd className="text-base-content font-medium">{selectedDemoAccount.label}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold text-base-content/60 min-w-24">Email</dt>
                    <dd className="text-base-content font-mono">{selectedDemoAccount.email}</dd>
                  </div>
                  {selectedDemoAccount.program && (
                    <div className="flex gap-2">
                      <dt className="font-semibold text-base-content/60 min-w-24">Program</dt>
                      <dd className="text-base-content">{formatProgram(selectedDemoAccount.program)}</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="font-semibold text-base-content/60 min-w-24">Description</dt>
                    <dd className="text-base-content/80">{selectedDemoAccount.description}</dd>
                  </div>
                </dl>
              </div>
            )}

            <button
              type="button"
              onClick={fillDemoCredentials}
              disabled={loading || success}
              className="btn btn-sm min-h-11 btn-outline border-base-content/30 hover:bg-base-200 text-base-content hover:text-base-content rounded-xl px-3 font-semibold w-full mt-4"
            >
              Fill Demo Credentials
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
