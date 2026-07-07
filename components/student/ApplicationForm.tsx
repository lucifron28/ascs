'use client';

import React, { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { submitApplicationAction } from '@/app/actions/clearance';
import { FileText, Send, AlertTriangle } from 'lucide-react';

interface ApplicationFormProps {
  onSuccess: () => void;
}

export default function ApplicationForm({ onSuccess }: ApplicationFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      academicYear: '2026-2027',
      semester: '1st',
      purpose: 'Enrollment',
      confirmCorrectness: false,
    },
    onSubmit: async ({ value }) => {
      if (!value.confirmCorrectness) {
        setError('You must confirm that all submitted details are correct.');
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
    <div className="card w-full bg-slate-900 border border-slate-800 shadow-2xl p-8 rounded-2xl max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <FileText className="w-5 h-5 text-indigo-400" /> Clearance Application
      </h2>

      {error && (
        <div className="alert alert-error bg-rose-950/80 border-rose-800 text-rose-300 rounded-xl mb-6 flex items-center gap-2 p-3 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
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
              <label className="label py-1">
                <span className="label-text text-slate-300 font-medium text-xs">Academic Year</span>
              </label>
              <select
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                disabled={loading}
                className="select select-bordered w-full bg-slate-950/50 border-slate-800 text-white rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm h-11"
              >
                <option value="2026-2027">2026-2027</option>
                <option value="2027-2028">2027-2028</option>
                <option value="2028-2029">2028-2029</option>
              </select>
            </div>
          )}
        </form.Field>

        {/* Semester */}
        <form.Field name="semester">
          {(field) => (
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-slate-300 font-medium text-xs">Semester</span>
              </label>
              <select
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                disabled={loading}
                className="select select-bordered w-full bg-slate-950/50 border-slate-800 text-white rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm h-11"
              >
                <option value="1st">1st Semester</option>
                <option value="2nd">2nd Semester</option>
                <option value="Summer">Summer Term</option>
              </select>
            </div>
          )}
        </form.Field>

        {/* Purpose */}
        <form.Field name="purpose">
          {(field) => (
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-slate-300 font-medium text-xs">Purpose</span>
              </label>
              <select
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                disabled={loading}
                className="select select-bordered w-full bg-slate-950/50 border-slate-800 text-white rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm h-11"
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
              <label className="label cursor-pointer justify-start gap-3 py-1">
                <input
                  type="checkbox"
                  name={field.name}
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  disabled={loading}
                  className="checkbox checkbox-primary bg-slate-950 border-slate-800 rounded-lg transition-all focus:outline-none"
                />
                <span className="label-text text-slate-400 text-xs">
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
          className="btn btn-primary w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-none rounded-xl transition-all active:scale-[0.98] mt-6 flex items-center justify-center gap-2 h-11 text-sm font-semibold"
        >
          {loading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <>
              <Send className="w-4 h-4" /> Submit Application
            </>
          )}
        </button>
      </form>
    </div>
  );
}
