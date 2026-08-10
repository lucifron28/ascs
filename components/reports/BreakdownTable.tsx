import React from 'react';
import type { GroupMetric } from '@/lib/reports/types';

interface BreakdownTableProps {
  title: string;
  description?: string;
  typeLabel: string;
  items: GroupMetric[];
}

export default function BreakdownTable({
  title,
  description,
  typeLabel,
  items,
}: BreakdownTableProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="card bg-base-100 border border-base-content/15 p-5 rounded-xl shadow-sm space-y-4">
      <div className="border-b border-base-content/15 pb-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-base-content">{title}</h3>
        {description && <p className="text-[11px] text-base-content/80 font-medium mt-0.5">{description}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm w-full text-xs">
          <thead>
            <tr className="text-base-content/60 border-b border-base-content/15">
              <th scope="col" className="font-semibold">{typeLabel}</th>
              <th scope="col" className="font-semibold text-right">Total Submitted</th>
              <th scope="col" className="font-semibold text-right">Approved</th>
              <th scope="col" className="font-semibold text-right">Pending</th>
              <th scope="col" className="font-semibold text-right">Not Approved</th>
              <th scope="col" className="font-semibold text-right">Completion Rate</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const ratePct = (item.completionRate * 100).toFixed(1);
              return (
                <tr key={item.key} className="hover:bg-base-200/50 transition-colors border-b border-base-content/5">
                  <td className="font-bold text-base-content">{item.label}</td>
                  <td className="text-right font-medium">{item.total}</td>
                  <td className="text-right font-semibold text-success">{item.approved}</td>
                  <td className="text-right font-semibold text-warning">{item.pending}</td>
                  <td className="text-right font-semibold text-error">{item.notApproved}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-bold text-base-content">{ratePct}%</span>
                      <div className="w-16 bg-base-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${Math.min(item.completionRate * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
