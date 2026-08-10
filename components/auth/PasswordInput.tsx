'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  leadingIcon?: ReactNode;
}

/** Password input with an accessible, theme-aware show/hide control. */
export default function PasswordInput({ leadingIcon, className = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {leadingIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/50">
          {leadingIcon}
        </div>
      )}
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className} ${leadingIcon ? 'pl-10' : ''} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        disabled={props.disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 btn btn-ghost min-h-11 h-11 w-11 rounded-lg text-base-content/60 hover:text-base-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
