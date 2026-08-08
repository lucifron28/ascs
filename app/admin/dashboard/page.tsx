'use client';

import React from 'react';
import RoleHeader from '@/components/layout/RoleHeader';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { LayoutDashboard, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const adminNavLinks = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" />, active: true },
    { label: 'Reports', href: '/admin/reports', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-base-300 text-base-content font-sans flex flex-col transition-colors duration-200">
      <RoleHeader roleTitle="System Administrator" navLinks={adminNavLinks} />
      <main id="main-content" className="flex-1">
        <AdminDashboard />
      </main>
    </div>
  );
}
