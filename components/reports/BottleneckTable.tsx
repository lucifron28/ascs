import React from 'react';
import type { RequirementMetric } from '@/lib/reports/types';
import { AlertTriangle } from 'lucide-react';

interface BottleneckTableProps {
  items: RequirementMetric[];
  title?: string;
}

export default function BottleneckTable({
  items,
  title = 'Highest Unresolved Requirements (Bottleneck Analysis)',
}: BottleneckTableProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="card bg-base-100 border border-base-content/15 p-5 rounded-xl shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-base-content/15 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-base-content">{title}</h3>
        </div>
        <span className="text-[10px] text-base-content/80 font-bold">
          Sorted by Total Unresolved (Pending + Not Approved)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm w-full text-xs">
          <thead>
            <tr className="text-base-content/60 border-b border-base-content/15">
              <th scope="col" className="font-semibold">Requirement Office</th>
              <th scope="col" className="font-semibold">Role</th>
              <th scope="col" className="font-semibold text-right">Total Assigned</th>
              <th scope="col" className="font-semibold text-right">Approved</th>
              <th scope="col" className="font-semibold text-right">Pending</th>
              <th scope="col" className="font-semibold text-right">Not Approved</th>
              <th scope="col" className="font-semibold text-right">Unresolved Count</th>
              <th scope="col" className="font-semibold text-right">Completion Rate</th>
            </tr>
          </thead>
          <tbody>
            {items.map((req) => {
              const ratePct = (req.completionRate * 100).toFixed(1);
              const isHighBottleneck = req.unresolvedCount > 0;

              return (
                <tr key={req.requirementId} className="hover:bg-base-200/50 transition-colors border-b border-base-content/5">
                  <td className="font-bold text-base-content flex items-center gap-2">
                    {req.label}
                  </td>
                  <td className="uppercase text-[10px] font-semibold text-base-content/60">
                    {req.role.replace('_', ' ')}
                  </td>
                  <td className="text-right font-medium">{req.totalAssigned}</td>
                  <td className="text-right font-semibold text-success">{req.approved}</td>
                  <td className="text-right font-semibold text-warning">{req.pending}</td>
                  <td className="text-right font-semibold text-error">{req.notApproved}</td>
                  <td className="text-right">
                    <span
                      className={`badge badge-sm font-black rounded-md ${
                        isHighBottleneck ? 'badge-warning text-warning-content' : 'badge-ghost'
                      }`}
                    >
                      {req.unresolvedCount}
                    </span>
                  </td>
                  <td className="text-right font-bold text-base-content">{ratePct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
