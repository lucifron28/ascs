'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Shield } from 'lucide-react';
import ThemeSelector from '@/components/ui/ThemeSelector';
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
        <div className="flex-1">
          <span className="font-extrabold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary flex items-center gap-1.5">
            <Shield className="w-5 h-5 text-primary shrink-0" /> ASCS PKM
          </span>
        </div>
        <div className="flex-none flex items-center gap-3">
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
