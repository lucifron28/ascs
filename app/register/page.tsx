'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpen, Mail, Phone, UserRound } from 'lucide-react';
import ThemeSelector from '@/components/ui/ThemeSelector';
import PasswordInput from '@/components/auth/PasswordInput';
import { registerStudentAccountAction } from '@/app/actions/registration';
import { ACADEMIC_PROGRAM_CODES, ACADEMIC_PROGRAMS } from '@/lib/academic-programs';

const inputClassName =
  'input input-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl placeholder-base-content/40 text-sm h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const selectClassName =
  'select select-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl text-sm min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const initialForm = {
  fullName: '',
  studentNumber: '',
  email: '',
  contactNumber: '',
  program: 'BSAIS',
  yearLevel: '1st Year',
  section: 'A',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await registerStudentAccountAction(form);
      if (!result.success) {
        setError(result.error);
        return;
      }

      setForm((current) => ({ ...current, password: '', confirmPassword: '' }));
      setRegisteredEmail(result.user.email);
    } catch (registrationError: unknown) {
      setError(registrationError instanceof Error ? registrationError.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-base-300 text-base-content font-sans transition-colors duration-200">
      <div className="absolute top-4 right-4 z-50">
        <ThemeSelector />
      </div>

      <main id="main-content" className="mx-auto w-full max-w-3xl p-4 py-10 sm:py-14">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/pkmlogo.png"
            alt="Pamantasan ng Kolehiyo ng Mauban seal"
            width={96}
            height={96}
            preload
            className="mb-3 h-20 w-20 object-contain"
          />
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">Create a Student Account</h1>
          <p className="mt-2 max-w-xl text-sm font-medium text-base-content/70">
            Register for ASCS PKM using your own student information. Staff and signatory accounts are created by an administrator.
          </p>
        </div>

        <div className="card w-full rounded-2xl border border-base-content/15 bg-base-100 p-6 shadow-lg sm:p-8">
          {registeredEmail ? (
            <div className="space-y-5 text-center" role="status" aria-live="polite">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                <ArrowRight className="h-6 w-6 -rotate-45" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-base-content">Account created</h2>
                <p className="mt-2 text-sm text-base-content/70">
                  Your student account for <span className="font-semibold text-base-content">{registeredEmail}</span> is ready. Sign in to continue.
                </p>
              </div>
              <Link
                href="/login"
                className="btn btn-primary min-h-11 w-full rounded-xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Continue to sign in
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div role="alert" className="alert alert-error flex items-start gap-2 rounded-xl p-3 text-sm font-medium text-error-content">
                  <span aria-hidden="true">!</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="form-control">
                  <label htmlFor="register-full-name" className="label py-1">
                    <span className="label-text text-xs font-semibold text-base-content/80">Full name</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-base-content/50">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="register-full-name"
                      name="fullName"
                      value={form.fullName}
                      onChange={(event) => updateField('fullName', event.target.value)}
                      disabled={loading}
                      autoComplete="name"
                      required
                      placeholder="Juan Dela Cruz"
                      className={`${inputClassName} pl-10`}
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label htmlFor="register-student-number" className="label py-1">
                    <span className="label-text text-xs font-semibold text-base-content/80">Student number</span>
                  </label>
                  <input
                    id="register-student-number"
                    name="studentNumber"
                    value={form.studentNumber}
                    onChange={(event) => updateField('studentNumber', event.target.value)}
                    disabled={loading}
                    required
                    placeholder="STUD-2026-0008"
                    className={`${inputClassName} font-mono`}
                  />
                </div>

                <div className="form-control">
                  <label htmlFor="register-email" className="label py-1">
                    <span className="label-text text-xs font-semibold text-base-content/80">Email address</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-base-content/50">
                      <Mail className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="register-email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      disabled={loading}
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={`${inputClassName} pl-10`}
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label htmlFor="register-contact" className="label py-1">
                    <span className="label-text text-xs font-semibold text-base-content/80">Contact number <span className="font-normal text-base-content/50">(optional)</span></span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-base-content/50">
                      <Phone className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="register-contact"
                      name="contactNumber"
                      type="tel"
                      value={form.contactNumber}
                      onChange={(event) => updateField('contactNumber', event.target.value)}
                      disabled={loading}
                      autoComplete="tel"
                      placeholder="09XXXXXXXXX"
                      className={`${inputClassName} pl-10`}
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label htmlFor="register-program" className="label py-1">
                    <span className="label-text text-xs font-semibold text-base-content/80">Academic program</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-base-content/50">
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <select
                      id="register-program"
                      name="program"
                      value={form.program}
                      onChange={(event) => updateField('program', event.target.value)}
                      disabled={loading}
                      required
                      className={`${selectClassName} pl-10`}
                    >
                      {ACADEMIC_PROGRAM_CODES.map((code) => (
                        <option key={code} value={code}>
                          {code} — {ACADEMIC_PROGRAMS[code]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-control">
                    <label htmlFor="register-year-level" className="label py-1">
                      <span className="label-text text-xs font-semibold text-base-content/80">Year level</span>
                    </label>
                    <select
                      id="register-year-level"
                      name="yearLevel"
                      value={form.yearLevel}
                      onChange={(event) => updateField('yearLevel', event.target.value)}
                      disabled={loading}
                      required
                      className={selectClassName}
                    >
                      {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-control">
                    <label htmlFor="register-section" className="label py-1">
                      <span className="label-text text-xs font-semibold text-base-content/80">Section</span>
                    </label>
                    <input
                      id="register-section"
                      name="section"
                      value={form.section}
                      onChange={(event) => updateField('section', event.target.value)}
                      disabled={loading}
                      required
                      placeholder="A"
                      className={inputClassName}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-5 border-t border-base-content/10 pt-5 sm:grid-cols-2">
                <div className="form-control">
                  <label htmlFor="register-password" className="label py-1">
                    <span className="label-text text-xs font-semibold text-base-content/80">Password <span className="font-normal text-base-content/50">(min. 8 characters)</span></span>
                  </label>
                  <PasswordInput
                    id="register-password"
                    name="password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    disabled={loading}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={inputClassName}
                  />
                </div>
                <div className="form-control">
                  <label htmlFor="register-confirm-password" className="label py-1">
                    <span className="label-text text-xs font-semibold text-base-content/80">Confirm password</span>
                  </label>
                  <PasswordInput
                    id="register-confirm-password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    disabled={loading}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={inputClassName}
                  />
                </div>
              </div>

              <p className="text-xs leading-relaxed text-base-content/60">
                By registering, you confirm that the student details are accurate. Your account is created as a student account only.
              </p>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="btn btn-primary min-h-12 w-full rounded-xl text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create student account
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {!registeredEmail && (
          <p className="mt-6 text-center text-sm text-base-content/70">
            Already registered?{' '}
            <Link
              href="/login"
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Sign in
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
