'use client';

import React from 'react';
import RoleHeader from '@/components/layout/RoleHeader';
import DeanDashboard from '@/components/dean/DeanDashboard';
import { Eye, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const deanNavLinks = [
    { label: 'Oversight', href: '/dean/dashboard', icon: <Eye className="w-3.5 h-3.5" />, active: true },
    { label: 'Reports', href: '/dean/reports', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-base-300 text-base-content font-sans flex flex-col transition-colors duration-200">
      <RoleHeader roleTitle="Academic Dean" navLinks={deanNavLinks} />

      {/* Main Content */}
      <main id="main-content" className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-base-content">
            Dean Clearance Oversight
          </h1>
          <p className="text-base-content/70 text-sm mt-1 font-medium">
            Read-only tracking of students cleared by academic advisers.
          </p>
        </div>
        <DeanDashboard />
      </main>
    </div>
  );
}
