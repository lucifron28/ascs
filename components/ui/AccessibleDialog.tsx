'use client';

import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';

interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  preventClose?: boolean;
  maxWidthClass?: string;
}

export default function AccessibleDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  preventClose = false,
  maxWidthClass = 'max-w-lg',
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (isOpen) {
      // 1. Remember triggering element
      previousFocusRef.current = document.activeElement as HTMLElement;

      // 2. Focus first focusable element or dialog container
      const timer = setTimeout(() => {
        if (dialogRef.current) {
          const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusables.length > 0) {
            focusables[0].focus();
          } else {
            dialogRef.current.focus();
          }
        }
      }, 50);

      return () => clearTimeout(timer);
    } else if (previousFocusRef.current) {
      // 6. Restore focus when closed
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Handle Escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!preventClose) {
          onClose();
        }
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, preventClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !preventClose) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`card w-full ${maxWidthClass} bg-base-100 border border-base-content/15 shadow-lg rounded-xl max-h-[90vh] flex flex-col focus:outline-none`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-base-content/15 shrink-0">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-base-content tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-xs text-base-content/70 mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={preventClose}
            aria-label="Close dialog"
            className="btn btn-sm min-h-11 min-w-11 btn-circle btn-ghost text-base-content/70 hover:text-base-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">{children}</div>
      </div>
    </div>
  );
}
