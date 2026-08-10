'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Palette, ChevronDown } from 'lucide-react';

const THEMES = [
  { id: 'ascs-light', name: 'ASCS Light' },
  { id: 'ascs-dark', name: 'ASCS Dark' },
] as const;

function normalizeTheme(theme: string | null) {
  return theme === 'dark' || theme === 'night' || theme === 'ascs-dark'
    ? 'ascs-dark'
    : 'ascs-light';
}

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<(typeof THEMES)[number]['id']>('ascs-light');
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const currentThemeName = THEMES.find((theme) => theme.id === currentTheme)?.name || 'ASCS Light';

  useEffect(() => {
    setCurrentTheme(normalizeTheme(document.documentElement.getAttribute('data-theme')));
  }, []);

  const changeTheme = (theme: (typeof THEMES)[number]['id']) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? THEMES.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + THEMES.length) % THEMES.length;
      optionRefs.current[nextIndex]?.focus();
    }
  };

  // Close on outside click or Escape.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
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
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Change theme"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="theme-selector-dropdown"
        className="btn btn-sm btn-ghost min-h-11 hover:bg-base-content/10 text-base-content hover:text-base-content rounded-lg flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Palette className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline text-sm font-semibold">{currentThemeName}</span>
        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          id="theme-selector-dropdown"
          role="menu"
          aria-label="Select theme"
          className="absolute right-0 mt-1.5 w-52 bg-base-100 border border-base-content/15 rounded-xl shadow-lg p-2 z-50 space-y-1 focus:outline-none"
        >
          {THEMES.map((theme, index) => (
            <li key={theme.id} role="none">
              <button
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                role="menuitem"
                type="button"
                onClick={() => changeTheme(theme.id)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`w-full flex items-center justify-between text-sm min-h-11 py-2 px-3 rounded-lg transition-colors text-left ${
                  currentTheme === theme.id
                    ? 'bg-primary text-primary-content font-bold'
                    : 'text-base-content hover:bg-base-200'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
              >
                <span>{theme.name}</span>
                {currentTheme === theme.id && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
