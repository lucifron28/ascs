'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { LogIn, Mail, Lock, ShieldAlert, Check } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
          throw new Error('Failed to establish session.');
        }

        // 4. Fetch the profile details to determine the user role
        const profileRes = await fetch('/api/auth/profile');
        if (!profileRes.ok) {
          throw new Error('Failed to retrieve profile details.');
        }

        const { profile } = await profileRes.json();
        const role = profile.role || 'student';

        setSuccess(true);

        // 5. Short timeout for smooth visual transition
        setTimeout(() => {
          router.push(`/${role}/dashboard`);
          router.refresh();
        }, 1000);
      } catch (err: any) {
        console.error('Login error:', err);
        let friendlyMessage = 'Authentication failed. Please check your credentials.';
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          friendlyMessage = 'Invalid email or password.';
        } else if (err.code === 'auth/network-request-failed') {
          friendlyMessage = 'Network error. Please check your connection.';
        } else if (err.message) {
          friendlyMessage = err.message;
        }
        setError(friendlyMessage);
        setLoading(false);
      }
    },
  });

  // Pre-fill helper for quick testing/demoing
  const quickFill = (email: string) => {
    form.setFieldValue('email', email);
    form.setFieldValue('password', 'password123');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden font-sans">
      {/* Background Radial Glow */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative w-full max-w-md p-4 z-10">
        {/* Title / Logo Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            ASCS PKM
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Automated Student Clearance & Financial Monitoring
          </p>
        </div>

        {/* Login Glassmorphism Card */}
        <div className="card w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl p-8 rounded-2xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-indigo-400" /> Sign In
          </h2>

          {/* Success Notification Alert */}
          {success && (
            <div className="alert alert-success bg-emerald-950/80 border-emerald-800 text-emerald-300 rounded-xl mb-6 flex items-center gap-2 p-3 text-sm">
              <Check className="w-4 h-4 shrink-0" />
              <span>Login successful! Redirecting to dashboard...</span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="alert alert-error bg-rose-950/80 border-rose-800 text-rose-300 rounded-xl mb-6 flex items-center gap-2 p-3 text-sm">
              <ShieldAlert className="w-4 h-4 shrink-0" />
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
              children={(field) => (
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-slate-300 font-medium text-xs">Email Address</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={loading || success}
                      placeholder="student@pkm.edu.ph"
                      className="input input-bordered w-full pl-10 bg-slate-950/50 border-slate-800 focus:border-indigo-500 text-white rounded-xl placeholder-slate-600 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <label className="label py-1">
                      <span className="label-text-alt text-rose-400 text-xs">
                        {field.state.meta.errors.join(', ')}
                      </span>
                    </label>
                  )}
                </div>
              )}
            />

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
              children={(field) => (
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-slate-300 font-medium text-xs">Password</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={loading || success}
                      placeholder="••••••••"
                      className="input input-bordered w-full pl-10 bg-slate-950/50 border-slate-800 focus:border-indigo-500 text-white rounded-xl placeholder-slate-600 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <label className="label py-1">
                      <span className="label-text-alt text-rose-400 text-xs">
                        {field.state.meta.errors.join(', ')}
                      </span>
                    </label>
                  )}
                </div>
              )}
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="btn btn-primary w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-none rounded-xl transition-all shadow-lg shadow-indigo-950/20 active:scale-[0.98] mt-6 flex items-center justify-center gap-2 h-11 text-sm font-semibold"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Log In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo Credentials Quick Fill Panel */}
        <div className="card w-full mt-6 bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl">
          <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
            Demo Credentials (Quick-Fill)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => quickFill('student@pkm.edu.ph')}
              disabled={loading || success}
              className="btn btn-xs btn-outline border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg p-1 font-medium lowercase truncate"
            >
              student@pkm.edu.ph
            </button>
            <button
              onClick={() => quickFill('admin@pkm.edu.ph')}
              disabled={loading || success}
              className="btn btn-xs btn-outline border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg p-1 font-medium lowercase truncate"
            >
              admin@pkm.edu.ph
            </button>
            <button
              onClick={() => quickFill('librarian@pkm.edu.ph')}
              disabled={loading || success}
              className="btn btn-xs btn-outline border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg p-1 font-medium lowercase truncate"
            >
              librarian@pkm.edu.ph
            </button>
            <button
              onClick={() => quickFill('dean@pkm.edu.ph')}
              disabled={loading || success}
              className="btn btn-xs btn-outline border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg p-1 font-medium lowercase truncate"
            >
              dean@pkm.edu.ph
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
