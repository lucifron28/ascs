import React from 'react';

interface SkipLinkProps {
  targetId?: string;
  label?: string;
}

export default function SkipLink({
  targetId = 'main-content',
  label = 'Skip to main content',
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-primary focus:text-primary-content focus:rounded-xl focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary font-bold text-sm uppercase tracking-wider transition-all"
    >
      {label}
    </a>
  );
}
