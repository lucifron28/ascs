'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchAdminReportSummaryAction,
  fetchReportFilterOptionsAction,
} from '@/app/actions/reports';
import type { ReportFilters, ReportSummary } from '@/lib/reports/types';
import { getDefaultAcademicYear, getDefaultSemester } from '@/lib/reports/filters';
import ReportFiltersComponent, { type FilterOptions } from '@/components/reports/ReportFilters';
import SummaryCards from '@/components/reports/SummaryCards';
import BottleneckTable from '@/components/reports/BottleneckTable';
import BreakdownTable from '@/components/reports/BreakdownTable';
import ReportEmptyState from '@/components/reports/ReportEmptyState';
import CsvExportButton from '@/components/reports/CsvExportButton';
import { LayoutDashboard, BarChart3, AlertCircle } from 'lucide-react';
import RoleHeader from '@/components/layout/RoleHeader';

export default function AdminReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({
    academicYear: getDefaultAcademicYear(),
    semester: getDefaultSemester(),
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    academicYears: [getDefaultAcademicYear()],
    semesters: [getDefaultSemester()],
    programs: [],
    yearLevels: [],
    sections: [],
  });

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFilterOptions = async () => {
    try {
      const res = await fetchReportFilterOptionsAction('admin');
      if (res.success && res.filterOptions) {
        setFilterOptions(res.filterOptions);
      }
    } catch (err: unknown) {
      console.error('Error fetching filter options:', err);
    }
  };

  const loadReportData = async (activeFilters: ReportFilters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminReportSummaryAction(activeFilters);
      if (res.success && res.summary) {
        setSummary(res.summary);
      } else {
        setError(res.error || 'Failed to load Admin report summary.');
        setSummary(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection error loading report data.';
      setError(message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
    loadReportData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = (newFilters: ReportFilters) => {
    setFilters(newFilters);
    loadReportData(newFilters);
  };

  const handleResetFilters = () => {
    const defaultF: ReportFilters = {
      academicYear: getDefaultAcademicYear(),
      semester: getDefaultSemester(),
    };
    setFilters(defaultF);
    loadReportData(defaultF);
  };

  const adminNavLinks = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { label: 'Reports', href: '/admin/reports', icon: <BarChart3 className="w-3.5 h-3.5" />, active: true },
  ];

  return (
    <div className="min-h-screen bg-base-300 text-base-content font-sans flex flex-col transition-colors duration-200">
      <RoleHeader roleTitle="System Administrator" navLinks={adminNavLinks} />

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Page Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-base-content flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-primary shrink-0" /> Institution Clearance & Analytical Reports
            </h1>
            <p className="text-base-content/70 text-xs md:text-sm mt-1">
              Institution-wide clearance metrics, office bottlenecks, program breakdowns, and CSV data exports.
            </p>
          </div>

          {summary && (
            <div className="shrink-0">
              <CsvExportButton scope="admin" filters={filters} />
            </div>
          )}
        </div>

        {/* Filter Controls */}
        <ReportFiltersComponent
          filters={filters}
          options={filterOptions}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          loading={loading}
          scope="admin"
        />

        {/* Error Alert */}
        {error && (
          <div role="alert" className="alert alert-error text-sm rounded-xl flex items-center gap-2 p-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card bg-base-100 border border-base-content/15 p-5 rounded-xl h-28 animate-pulse bg-base-200/50" />
              ))}
            </div>
            <div className="card bg-base-100 border border-base-content/15 p-6 rounded-xl h-64 animate-pulse bg-base-200/50" />
          </div>
        )}

        {/* Report Display */}
        {!loading && summary && (
          <>
            {summary.applicationSummary.total === 0 ? (
              <ReportEmptyState onReset={handleResetFilters} />
            ) : (
              <div className="space-y-6">
                {/* Summary Cards */}
                <SummaryCards summary={summary} />

                {/* Requirement Bottlenecks Table */}
                <BottleneckTable items={summary.highestUnresolvedRequirements} />

                {/* Program Breakdown Table */}
                <BreakdownTable
                  title="Clearance Progress by Academic Program"
                  description="Submitted application status totals and completion rates per program"
                  typeLabel="Academic Program"
                  items={summary.programBreakdown}
                />

                {/* Year Level Breakdown Table */}
                <BreakdownTable
                  title="Clearance Progress by Year Level"
                  description="Submitted application status totals per year level"
                  typeLabel="Year Level"
                  items={summary.yearLevelBreakdown}
                />

                {/* Section Breakdown Table */}
                <BreakdownTable
                  title="Clearance Progress by Class Section"
                  description="Submitted application status totals per class section"
                  typeLabel="Section"
                  items={summary.sectionBreakdown}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
