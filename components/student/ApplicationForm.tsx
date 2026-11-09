'use client';

import React, { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { submitApplicationAction } from '@/app/actions/clearance';
import { validateAcademicYear } from '@/lib/reports/filters';
import { FileText, Send, AlertTriangle } from 'lucide-react';

const SUGGESTED_ACADEMIC_YEARS = ['2025-2026', '2026-2027', '2027-2028', '2028-2029'];
const ACADEMIC_YEAR_ERROR = 'Enter a valid academic year in YYYY-YYYY format using consecutive years, such as 2026-2027.';

function getAcademicYearError(value: string): string | null {
  try {
    validateAcademicYear(value);
    return null;
  } catch {
    return ACADEMIC_YEAR_ERROR;
  }
}

interface ApplicationFormProps {
  onSuccess: () => void;
}

export default function ApplicationForm({ onSuccess }: ApplicationFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [academicYearError, setAcademicYearError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      academicYear: '2026-2027',
      semester: '1st Semester',
      purpose: 'Enrollment',
      confirmCorrectness: false,
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const validationError = getAcademicYearError(value.academicYear);
      if (validationError) {
        setAcademicYearError(validationError);
        setTimeout(() => {
          document.getElementById('academicYear')?.focus();
        }, 50);
        return;
      }

      setAcademicYearError(null);
      if (!value.confirmCorrectness) {
        setError('You must confirm that all submitted details are correct.');
        setTimeout(() => {
          document.getElementById('confirmCorrectness')?.focus();
        }, 50);
        return;
      }

      setLoading(true);
      setError(null);

      const res = await submitApplicationAction({
        academicYear: value.academicYear,
        semester: value.semester,
        purpose: value.purpose,
      });

      setLoading(false);

      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Failed to submit application.');
      }
    },
  });

  return (
    <div className="card w-full bg-base-100 border border-base-content/15 shadow-sm p-8 rounded-xl max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-base-content mb-6 flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" aria-hidden="true" /> Start Clearance Application
      </h2>

      {error && (
        <div
          id="application-form-error"
          role="alert"
          className="alert alert-error text-error-content rounded-xl mb-6 flex items-center gap-2 p-3 text-xs font-medium"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-5"
      >
        {/* Academic Year */}
        <form.Field name="academicYear">
          {(field) => (
            <div className="form-control w-full">
              <label htmlFor="academicYear" className="label py-1">
                <span className="label-text text-base-content/80 font-medium text-xs">Academic Year</span>
              </label>
              <input
                id="academicYear"
                type="text"
                list="academic-year-suggestions"
                name={field.name}
                value={field.state.value}
                placeholder="YYYY-YYYY"
                maxLength={9}
                onChange={(e) => {
                  const value = e.target.value;
                  field.handleChange(value);
                  if (academicYearError) setAcademicYearError(getAcademicYearError(value));
                }}
                onBlur={() => {
                  field.handleBlur();
                  setAcademicYearError(getAcademicYearError(field.state.value));
                }}
                disabled={loading}
                aria-invalid={!!academicYearError}
                aria-describedby={academicYearError ? 'academicYear-help academicYear-error' : 'academicYear-help'}
                className="input input-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl text-sm h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <datalist id="academic-year-suggestions">
                {SUGGESTED_ACADEMIC_YEARS.map((academicYear) => (
                  <option key={academicYear} value={academicYear} />
                ))}
              </datalist>
              <p id="academicYear-help" className="text-base-content/60 text-xs mt-1">
                Enter the format YYYY-YYYY, for example, 2026-2027.
              </p>
              {academicYearError && (
                <p id="academicYear-error" role="alert" className="text-error text-xs mt-1">
                  {academicYearError}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Semester */}
        <form.Field name="semester">
          {(field) => (
            <div className="form-control w-full">
              <label htmlFor="semester" className="label py-1">
                <span className="label-text text-base-content/80 font-medium text-xs">Semester</span>
              </label>
              <select
                id="semester"
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                disabled={loading}
                className="select select-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl text-sm h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
                <option value="Summer Semester">Summer Semester</option>
              </select>
            </div>
          )}
        </form.Field>

        {/* Purpose */}
        <form.Field name="purpose">
          {(field) => (
            <div className="form-control w-full">
              <label htmlFor="purpose" className="label py-1">
                <span className="label-text text-base-content/80 font-medium text-xs">Purpose</span>
              </label>
              <select
                id="purpose"
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                disabled={loading}
                className="select select-bordered w-full bg-base-200 border-base-content/15 text-base-content rounded-xl text-sm h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="Enrollment">Enrollment / Registration</option>
                <option value="Graduation">Graduation / Completion</option>
                <option value="Transfer">Transfer / Honorable Dismissal</option>
                <option value="Evaluation">Evaluation / Student Record Request</option>
              </select>
            </div>
          )}
        </form.Field>

        {/* Confirmation Checkbox */}
        <form.Field name="confirmCorrectness">
          {(field) => (
            <div className="form-control w-full mt-4">
              <label htmlFor="confirmCorrectness" className="label cursor-pointer justify-start gap-3 py-1">
                <input
                  id="confirmCorrectness"
                  type="checkbox"
                  name={field.name}
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  disabled={loading}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'application-form-error' : undefined}
                  className="checkbox checkbox-primary rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <span className="label-text text-base-content/70 text-sm leading-5 font-medium">
                  I confirm that all entered details are accurate. I understand that submitting false info will hold up my clearance processing.
                </span>
              </label>
            </div>
          )}
        </form.Field>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="btn btn-primary w-full text-primary-content border-none rounded-xl transition-all shadow-sm mt-6 flex items-center justify-center gap-2 min-h-12 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {loading ? (
            <>
              <span className="loading loading-spinner loading-sm" aria-hidden="true" />
              <span>Submitting Application...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>Submit Application</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
