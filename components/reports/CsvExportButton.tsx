import React, { useState } from 'react';
import type { ReportFilters, AdminReportExportType, DeanReportExportType } from '@/lib/reports/types';
import { exportAdminReportCsvAction, exportDeanReportCsvAction } from '@/app/actions/reports';
import { Download, FileSpreadsheet, ChevronDown, Check } from 'lucide-react';

interface CsvExportButtonProps {
  scope: 'admin' | 'dean';
  filters: ReportFilters;
}

export default function CsvExportButton({ scope, filters }: CsvExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleExport = async (exportType: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let res;
      if (scope === 'admin') {
        res = await exportAdminReportCsvAction(filters, exportType as AdminReportExportType);
      } else {
        res = await exportDeanReportCsvAction(filters, exportType as DeanReportExportType);
      }

      if (!res.success || !res.csvContent || !res.filename) {
        throw new Error(res.error || 'Failed to generate CSV export file.');
      }

      // Trigger client file download using Blob
      const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccessMsg(`Downloaded ${res.filename}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'CSV export error.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <div className="dropdown dropdown-end">
        <label
          tabIndex={0}
          className={`btn btn-sm ${
            loading ? 'btn-disabled' : 'btn-primary'
          } rounded-xl text-xs font-semibold gap-1.5 shadow-md`}
        >
          {loading ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>Export CSV</span>
          <ChevronDown className="w-3 h-3 opacity-70" />
        </label>

        <ul
          tabIndex={0}
          className="dropdown-content z-30 menu p-2 shadow-lg bg-base-100 border border-base-content/15 rounded-xl w-60 text-sm space-y-1 mt-1"
        >
          <li className="menu-title text-[10px] uppercase font-bold text-base-content/50 px-2 py-1">
            Choose Export Type
          </li>
          <li>
            <button onClick={() => handleExport('summary')} className="flex items-center gap-2 py-2">
              <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
              <span>Summary Metrics CSV</span>
            </button>
          </li>
          <li>
            <button onClick={() => handleExport('requirement-breakdown')} className="flex items-center gap-2 py-2">
              <FileSpreadsheet className="w-4 h-4 text-warning shrink-0" />
              <span>Requirement Bottlenecks CSV</span>
            </button>
          </li>
          <li>
            <button onClick={() => handleExport('program-breakdown')} className="flex items-center gap-2 py-2">
              <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
              <span>Program Breakdown CSV</span>
            </button>
          </li>
          <li>
            <button onClick={() => handleExport('application-detail')} className="flex items-center gap-2 py-2">
              <FileSpreadsheet className="w-4 h-4 text-success shrink-0" />
              <span>Application Details CSV</span>
            </button>
          </li>
        </ul>
      </div>

      {error && (
        <div className="toast toast-end toast-bottom z-50">
          <div className="alert alert-error text-xs rounded-xl shadow-lg">
            <span>{error}</span>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="toast toast-end toast-bottom z-50">
          <div className="alert alert-success text-xs rounded-xl shadow-lg flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
