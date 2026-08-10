import React from 'react';
import { FileQuestion, RefreshCw } from 'lucide-react';

interface ReportEmptyStateProps {
  message?: string;
  onReset?: () => void;
}

export default function ReportEmptyState({
  message = 'No submitted clearance applications match the selected academic term and filters.',
  onReset,
}: ReportEmptyStateProps) {
  return (
    <div className="card bg-base-100 border border-base-content/15 p-8 text-center rounded-xl space-y-4 my-6 shadow-sm">
      <div className="w-14 h-14 bg-base-200 rounded-xl flex items-center justify-center mx-auto text-base-content/60">
        <FileQuestion className="w-7 h-7" />
      </div>
      <div className="max-w-md mx-auto space-y-1">
        <h3 className="font-bold text-base text-base-content">No Clearance Data Found</h3>
        <p className="text-xs text-base-content/60 leading-relaxed">{message}</p>
      </div>
      {onReset && (
        <div>
          <button
            onClick={onReset}
            className="btn btn-sm btn-outline rounded-xl gap-1.5 font-medium text-xs mx-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
