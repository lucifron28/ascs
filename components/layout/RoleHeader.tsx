'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, X, Info } from 'lucide-react';
import { signOut } from 'firebase/auth';
import SkipLink from './SkipLink';
import ThemeSelector from '@/components/ui/ThemeSelector';
import NotificationDropdown from '@/components/ui/NotificationDropdown';
import { firebaseAuth } from '@/lib/firebase/client';

export interface NavLinkItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
}

interface RoleHeaderProps {
  roleTitle: string;
  navLinks?: NavLinkItem[];
  userDisplayName?: string;
  onLogout?: () => void;
}

export default function RoleHeader({
  roleTitle,
  navLinks = [],
  userDisplayName,
  onLogout,
}: RoleHeaderProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Keep the safety banner visible for both local emulator demos and the
  // explicitly configured remote fictional-data demo deployment.
  const isDemo =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

  const defaultLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        // Clear the browser Firebase session as well as the HTTP-only server
        // cookie so a subsequent login in the same tab starts cleanly.
        await signOut(firebaseAuth).catch(() => undefined);
        router.replace('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleLogoutAction = onLogout || defaultLogout;

  // Handle Escape key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="bg-base-100 border-b border-base-content/15 sticky top-0 z-30 shrink-0">
      <SkipLink targetId="main-content" />

      {/* Demo Environment Banner / Indicator */}
      {isDemo && (
        <div className="bg-primary text-primary-content px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5" role="status">
          <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Demo Environment — Fictional Data</span>
        </div>
      )}

      <div className="navbar max-w-7xl mx-auto px-4 sm:px-6 min-h-[3.5rem]">
        {/* Branding & Main Nav */}
        <div className="flex-1 flex items-center gap-3 md:gap-6">
          <div
            className="font-extrabold text-base md:text-lg tracking-wider text-primary flex items-center gap-1.5 rounded-lg px-1 cursor-default select-none"
            aria-label={`ASCS PKM ${roleTitle}`}
          >
            <Image
              src="/pkmlogo.png"
              alt=""
              aria-hidden="true"
              width={44}
              height={44}
              className="h-9 w-9 shrink-0 object-contain"
            />
            <span className="truncate">ASCS PKM</span>
          </div>

          {/* Desktop Navigation Links */}
          {navLinks.length > 0 && (
            <nav className="hidden md:flex items-center gap-1.5" aria-label="Primary navigation">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`btn btn-sm min-h-11 rounded-lg gap-1.5 font-medium transition-all ${
                    item.active
                      ? 'btn-primary font-semibold'
                      : 'btn-ghost text-base-content/70 hover:text-base-content hover:bg-base-content/10'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.icon && <span aria-hidden="true">{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Header Controls */}
        <div className="flex-none flex items-center gap-2 sm:gap-3">
          {/* NotificationDropdown is ALWAYS visible in top header on both desktop & mobile */}
          <NotificationDropdown />

          {/* Desktop Only: ThemeSelector & Logout */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3">
            <ThemeSelector />
            {userDisplayName && (
              <span className="hidden xl:inline-block text-xs text-base-content/70 font-medium">
                {userDisplayName}
              </span>
            )}
            <button
              onClick={handleLogoutAction}
              className="btn btn-sm min-h-11 btn-ghost hover:bg-base-content/10 text-base-content/70 hover:text-base-content rounded-lg flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">Logout</span>
            </button>
          </div>

          {/* Mobile Only: Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden btn btn-sm min-h-11 min-w-11 btn-square btn-ghost text-base-content/80 hover:text-base-content rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={mobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="md:hidden bg-base-100 border-b border-base-content/15 px-4 py-3 space-y-3"
        >
          {navLinks.length > 0 && (
            <nav className="flex flex-col space-y-1" aria-label="Mobile navigation">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`btn btn-sm min-h-11 justify-start rounded-lg gap-2 font-medium ${
                    item.active
                      ? 'btn-primary font-semibold'
                      : 'btn-ghost text-base-content/80 hover:text-base-content hover:bg-base-content/10'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.icon && <span aria-hidden="true">{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          )}

          {/* Mobile Theme Selector & Logout */}
          <div className="pt-2 border-t border-base-content/15 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-base-content/70 font-semibold">Theme:</span>
              <ThemeSelector />
            </div>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogoutAction();
              }}
              className="btn btn-sm min-h-11 btn-error btn-outline rounded-lg gap-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
