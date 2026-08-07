'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Shield, LayoutDashboard, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import ThemeSelector from '@/components/ui/ThemeSelector';
import NotificationDropdown from '@/components/ui/NotificationDropdown';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function DashboardPage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-base-300 text-base-content font-sans flex flex-col transition-colors duration-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 border-b border-base-content/10 px-6 shrink-0 z-30 sticky top-0">
        <div className="flex-1 flex items-center gap-6">
          <span className="font-extrabold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary flex items-center gap-1.5">
            <Shield className="w-5 h-5 text-primary shrink-0" /> ASCS PKM
          </span>

          <nav className="flex items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="btn btn-xs btn-primary rounded-lg gap-1 font-semibold"
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <Link
              href="/admin/reports"
              className="btn btn-xs btn-ghost text-base-content/70 hover:text-base-content rounded-lg gap-1 font-medium"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Reports
            </Link>
          </nav>
        </div>
        <div className="flex-none flex items-center gap-3">
          <NotificationDropdown />
          <ThemeSelector />
          <button onClick={handleLogout} className="btn btn-sm btn-ghost hover:bg-base-content/10 text-base-content/70 hover:text-base-content rounded-lg flex items-center gap-1.5">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <AdminDashboard />
    </div>
  );
}
