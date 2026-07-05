'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import SignatoryDashboard from '@/components/signatory/SignatoryDashboard';
import { LogOut, Shield } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
      {/* Navbar */}
      <div className="navbar bg-slate-900 border-b border-slate-800 px-6 shrink-0 z-30 sticky top-0">
        <div className="flex-1">
          <span className="font-extrabold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center gap-1.5">
            <Shield className="w-5 h-5 text-indigo-400 shrink-0" /> ASCS PKM
          </span>
        </div>
        <div className="flex-none">
          <button onClick={handleLogout} className="btn btn-sm btn-ghost hover:bg-slate-800 text-slate-300 rounded-lg flex items-center gap-1.5">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl w-full mx-auto space-y-8 animate-fade-in">
        <SignatoryDashboard />
      </div>
    </div>
  );
}
