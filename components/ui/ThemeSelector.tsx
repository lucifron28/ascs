'use client';

import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const htmlTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    setCurrentTheme(htmlTheme);
  }, []);

  const changeTheme = (theme: string) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  };

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-ghost hover:bg-base-content/10 text-base-content/70 hover:text-base-content rounded-lg flex items-center gap-1.5"
      >
        <Palette className="w-4 h-4" />
        <span className="hidden sm:inline text-xs font-semibold capitalize">{currentTheme}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-2xl bg-base-200 border border-base-content/10 rounded-xl w-52 z-50 mt-1 max-h-80 overflow-y-auto"
      >
        {THEMES.map((theme) => (
          <li key={theme.id}>
            <button
              onClick={() => changeTheme(theme.id)}
              className={`flex items-center justify-between text-xs py-2 ${
                currentTheme === theme.id ? 'active font-bold' : ''
              }`}
            >
              <span>{theme.name}</span>
              <span className="opacity-50 text-[10px] uppercase font-mono">{theme.id}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
