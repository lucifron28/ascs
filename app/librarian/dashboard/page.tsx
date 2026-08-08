'use client';

import React from 'react';
import RoleHeader from '@/components/layout/RoleHeader';
import SignatoryDashboard from '@/components/signatory/SignatoryDashboard';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-base-300 text-base-content font-sans flex flex-col transition-colors duration-200">
      <RoleHeader roleTitle="Librarian Desk" />
      <main id="main-content" className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl w-full mx-auto space-y-8">
        <SignatoryDashboard />
      </main>
    </div>
  );
}
