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
          <Filter className="w-4 h-4 text-primary" aria-hidden="true" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-base-content">
            Report Parameters & Scope Filters
          </h3>
        </div>
        <span className="text-[10px] uppercase font-bold text-base-content/80 px-2 py-0.5 bg-base-200 rounded-md">
          {scope === 'admin' ? 'Institution Scope' : 'Academic Dean Oversight Scope'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {/* Academic Year */}
          <div className="form-control">
            <label id="report-filter-ay-label" htmlFor="report-filter-ay" className="label py-0.5 text-[11px] font-semibold text-base-content/70">
              Academic Year
            </label>
            <select
              id="report-filter-ay"
              aria-label="Academic Year"
              value={localFilters.academicYear}
              onChange={(e) => setLocalFilters({ ...localFilters, academicYear: e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            <label id="report-filter-sem-label" htmlFor="report-filter-sem" className="label py-0.5 text-[11px] font-semibold text-base-content/70">
              Semester
            </label>
            <select
              id="report-filter-sem"
              aria-label="Semester"
              value={localFilters.semester}
              onChange={(e) => setLocalFilters({ ...localFilters, semester: e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            <label id="report-filter-prog-label" htmlFor="report-filter-prog" className="label py-0.5 text-[11px] font-semibold text-base-content/70">
              Program
            </label>
            <select
              id="report-filter-prog"
              aria-label="Program"
              value={localFilters.program || 'all'}
              onChange={(e) => setLocalFilters({ ...localFilters, program: e.target.value === 'all' ? undefined : e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            <label id="report-filter-yl-label" htmlFor="report-filter-yl" className="label py-0.5 text-[11px] font-semibold text-base-content/70">
              Year Level
            </label>
            <select
              id="report-filter-yl"
              aria-label="Year Level"
              value={localFilters.yearLevel || 'all'}
              onChange={(e) => setLocalFilters({ ...localFilters, yearLevel: e.target.value === 'all' ? undefined : e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            <label id="report-filter-sec-label" htmlFor="report-filter-sec" className="label py-0.5 text-[11px] font-semibold text-base-content/70">
              Section
            </label>
            <select
              id="report-filter-sec"
              aria-label="Section"
              value={localFilters.section || 'all'}
              onChange={(e) => setLocalFilters({ ...localFilters, section: e.target.value === 'all' ? undefined : e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            <label id="report-filter-status-label" htmlFor="report-filter-status" className="label py-0.5 text-[11px] font-semibold text-base-content/70">
              Clearance Status
            </label>
            <select
              id="report-filter-status"
              aria-label="Clearance Status"
              value={localFilters.overallStatus || 'all'}
              onChange={(e) => setLocalFilters({ ...localFilters, overallStatus: e.target.value === 'all' ? undefined : e.target.value })}
              className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              <label id="report-filter-financial-label" htmlFor="report-filter-financial" className="label py-0.5 text-[11px] font-semibold text-base-content/70">
                Financial Status
              </label>
              <select
                id="report-filter-financial"
                aria-label="Financial Status"
                value={localFilters.financialStatus || 'all'}
                onChange={(e) => setLocalFilters({ ...localFilters, financialStatus: e.target.value === 'all' ? undefined : e.target.value })}
                className="select select-sm select-bordered bg-base-200 border-base-content/10 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            className="btn btn-sm btn-ghost rounded-xl text-xs gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="btn btn-sm btn-primary rounded-xl font-semibold text-xs gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : (
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Apply Filters</span>
          </button>
        </div>
      </form>
    </div>
  );
}
