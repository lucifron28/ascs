import React from 'react';
import type { ReportFilters } from '@/lib/reports/types';
import { Filter, RefreshCw, Search } from 'lucide-react';

export interface FilterOptions {
  academicYears: string[];
  semesters: string[];
  programs: string[];
  yearLevels: string[];
  sections: string[];
}

interface ReportFiltersProps {
  filters: ReportFilters;
  options: FilterOptions;
  onApply: (newFilters: ReportFilters) => void;
  onReset: () => void;
  loading?: boolean;
  scope: 'admin' | 'dean';
}

export default function ReportFiltersComponent({
  filters,
  options,
  onApply,
  onReset,
  loading = false,
  scope,
}: ReportFiltersProps) {
  const [localFilters, setLocalFilters] = React.useState<ReportFilters>(filters);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(localFilters);
  };

  return (
    <div className="card bg-base-100 border border-base-content/10 p-5 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-base-content">
            Report Parameters & Scope Filters
          </h3>
        </div>
        <span className="text-[10px] uppercase font-bold text-base-content/50 px-2 py-0.5 bg-base-200 rounded-md">
          {scope === 'admin' ? 'Institution Scope' : 'Academic Dean Oversight Scope'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {/* Academic Year */}
          <div className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-[11px] font-semibold text-base-content/70">Academic Year</span>
            </label>
            <select
              value={localFilters.academicYear}
              onChange={(e) => setLocalFilters({ ...localFilters, academicYear: e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
              disabled={loading}
            >
              {options.academicYears.map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-[11px] font-semibold text-base-content/70">Semester</span>
            </label>
            <select
              value={localFilters.semester}
              onChange={(e) => setLocalFilters({ ...localFilters, semester: e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
              disabled={loading}
            >
              {options.semesters.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Program */}
          <div className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-[11px] font-semibold text-base-content/70">Program</span>
            </label>
            <select
              value={localFilters.program || 'all'}
              onChange={(e) => setLocalFilters({ ...localFilters, program: e.target.value === 'all' ? undefined : e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
              disabled={loading}
            >
              <option value="all">All Programs</option>
              {options.programs.map((prog) => (
                <option key={prog} value={prog}>
                  {prog}
                </option>
              ))}
            </select>
          </div>

          {/* Year Level */}
          <div className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-[11px] font-semibold text-base-content/70">Year Level</span>
            </label>
            <select
              value={localFilters.yearLevel || 'all'}
              onChange={(e) => setLocalFilters({ ...localFilters, yearLevel: e.target.value === 'all' ? undefined : e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
              disabled={loading}
            >
              <option value="all">All Year Levels</option>
              {options.yearLevels.map((yl) => (
                <option key={yl} value={yl}>
                  Year {yl}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-[11px] font-semibold text-base-content/70">Section</span>
            </label>
            <select
              value={localFilters.section || 'all'}
              onChange={(e) => setLocalFilters({ ...localFilters, section: e.target.value === 'all' ? undefined : e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
              disabled={loading}
            >
              <option value="all">All Sections</option>
              {options.sections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Overall Clearance Status */}
          <div className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-[11px] font-semibold text-base-content/70">Clearance Status</span>
            </label>
            <select
              value={localFilters.overallStatus || 'all'}
              onChange={(e) => setLocalFilters({ ...localFilters, overallStatus: e.target.value === 'all' ? undefined : e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
              disabled={loading}
            >
              <option value="all">All Clearance Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Fully Approved</option>
              <option value="not_approved">Not Approved</option>
            </select>
          </div>

          {/* Financial Status (Admin only) */}
          {scope === 'admin' && (
            <div className="form-control">
              <label className="label py-0.5">
                <span className="label-text text-[11px] font-semibold text-base-content/70">Financial Status</span>
              </label>
              <select
                value={localFilters.financialStatus || 'all'}
                onChange={(e) => setLocalFilters({ ...localFilters, financialStatus: e.target.value === 'all' ? undefined : e.target.value })}
                className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs"
                disabled={loading}
              >
                <option value="all">All Financial Statuses</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="pending">Pending Verification</option>
              </select>
            </div>
          )}
        </div>

        {/* Form Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-base-content/10">
          <button
            type="button"
            onClick={() => {
              onReset();
            }}
            disabled={loading}
            className="btn btn-sm btn-ghost rounded-xl text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-sm btn-primary rounded-xl font-semibold text-xs gap-1.5"
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            Apply Filters
          </button>
        </div>
      </form>
    </div>
  );
}
