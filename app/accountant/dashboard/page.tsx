'use client';

import React from 'react';
import RoleHeader from '@/components/layout/RoleHeader';
import AccountantDashboard from '@/components/accountant/AccountantDashboard';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-base-300 text-base-content font-sans flex flex-col transition-colors duration-200">
      <RoleHeader roleTitle="Accountant Desk" />

      {/* Main Content */}
      <main id="main-content" className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-base-content">
            Accountant Clearance
          </h1>
          <p className="text-base-content/70 text-sm mt-1 font-medium">
            Step 2 of 6: review financial accountability after Librarian Clearance is approved.
          </p>
        </div>
        <AccountantDashboard />
      </main>
    </div>
  );
}
