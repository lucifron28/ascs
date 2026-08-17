'use client';

import React from 'react';
import RoleHeader from '@/components/layout/RoleHeader';
import { Info } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-base-300 text-base-content font-sans flex flex-col transition-colors duration-200">
      <RoleHeader roleTitle="Academic Adviser Desk" />
      <main id="main-content" className="flex-1 p-6 md:p-8 max-w-5xl w-full mx-auto">
        <section className="card bg-base-100 border border-base-content/15 shadow-sm rounded-xl">
          <div className="card-body items-start gap-4">
            <div className="flex items-center gap-3 text-warning">
              <Info className="w-6 h-6 shrink-0" aria-hidden="true" />
              <h1 className="card-title text-base-content">Legacy Adviser account</h1>
            </div>
            <p className="text-base-content/75 max-w-2xl">
              The Adviser clearance role has been retired from the active ASCS workflow. Please contact the System Administrator if your account requires reassignment.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
