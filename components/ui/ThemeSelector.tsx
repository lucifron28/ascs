'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Palette, ChevronDown } from 'lucide-react';

const THEMES = [
  { id: 'dark', name: 'Dark Mode' },
  { id: 'light', name: 'Light Mode' },
  { id: 'corporate', name: 'Corporate Light' },
  { id: 'night', name: 'Night Blue' },
  { id: 'sunset', name: 'Sunset Orange' },
  { id: 'business', name: 'Business Slate' },
  { id: 'dim', name: 'Muted Dim' },
  { id: 'abyss', name: 'Abyss Deep' },
  { id: 'forest', name: 'Forest Green' },
];

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const htmlTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    setCurrentTheme(htmlTheme);
  }, []);

  const changeTheme = (theme: string) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Change theme"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="theme-selector-dropdown"
        className="btn btn-sm btn-ghost hover:bg-base-content/10 text-base-content/70 hover:text-base-content rounded-lg flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Palette className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline text-xs font-semibold capitalize">{currentTheme}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          id="theme-selector-dropdown"
          role="menu"
          aria-label="Select theme"
          className="absolute right-0 mt-1.5 w-52 bg-base-200 border border-base-content/10 rounded-xl shadow-2xl p-2 z-50 max-h-80 overflow-y-auto space-y-1 focus:outline-none"
        >
          {THEMES.map((theme) => (
            <li key={theme.id} role="none">
              <button
                role="menuitem"
                type="button"
                onClick={() => changeTheme(theme.id)}
                className={`w-full flex items-center justify-between text-xs py-2 px-3 rounded-lg transition-colors text-left ${
                  currentTheme === theme.id
                    ? 'bg-primary text-primary-content font-bold'
                    : 'text-base-content hover:bg-base-content/10'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
              >
                <span>{theme.name}</span>
                <span className="opacity-60 text-[10px] uppercase font-mono">{theme.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
