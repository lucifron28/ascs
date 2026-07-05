'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
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
      <div className="navbar bg-slate-900 border-b border-slate-800 px-6">
        <div className="flex-1">
          <span className="font-bold text-lg tracking-wider text-indigo-400">ASCS PKM</span>
        </div>
        <div className="flex-none">
          <button onClick={handleLogout} className="btn btn-sm btn-ghost hover:bg-slate-800 text-slate-300 rounded-lg flex items-center gap-1">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="card w-full max-w-md bg-slate-900 border border-slate-800 shadow-2xl p-8 rounded-2xl text-center animate-fade-in">
          <div className="avatar placeholder mb-4 justify-center">
            <div className="bg-indigo-950 text-indigo-400 rounded-full w-16 h-16 flex items-center justify-center">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold capitalize mb-2">guidance counselor Dashboard</h1>
          <p className="text-slate-400 text-sm mb-6">Welcome to the Automated Student Clearance System. This dashboard is currently a stub for Phase 4 validation.</p>
          <div className="badge badge-indigo border-indigo-500/30 bg-indigo-950/50 text-indigo-300 p-3 rounded-md font-medium text-xs">Role: guidance_counselor</div>
        </div>
      </div>
    </div>
  );
}
