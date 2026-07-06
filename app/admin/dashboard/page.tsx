'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Shield } from 'lucide-react';
import ThemeSelector from '@/components/ui/ThemeSelector';

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
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="card w-full max-w-md bg-base-100 border border-base-content/10 shadow-2xl p-8 rounded-2xl text-center animate-fade-in">
          <div className="avatar placeholder mb-4 justify-center">
            <div className="bg-primary/10 text-primary rounded-full w-16 h-16 flex items-center justify-center">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold capitalize mb-2">admin Dashboard</h1>
          <p className="text-base-content/70 text-sm mb-6">Welcome to the Automated Student Clearance System. This dashboard is currently a stub for Phase 4 validation.</p>
          <div className="badge badge-primary border-primary/20 bg-primary/10 text-primary p-3 rounded-md font-medium text-xs">Role: admin</div>
        </div>
      </div>
    </div>
  );
}
