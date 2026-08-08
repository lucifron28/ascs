'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  fetchUserNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from '@/app/actions/notifications';
import { Bell, CheckCheck, FileText, CheckCircle2, CreditCard, Info } from 'lucide-react';

interface NotificationItem {
  id: string;
  recipientId: string;
  type: string;
  message: string;
  relatedApplicationId: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const isMounted = useRef(true);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      const res = await fetchUserNotificationsAction();
      if (isMounted.current && res.success) {
        setNotifications((res.notifications as unknown as NotificationItem[]) || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    loadNotifications();
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle outside click & Escape key
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

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationAsReadAction({ notificationId: id });
      loadNotifications();
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await markAllNotificationsAsReadAction();
      loadNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'submission':
      case 'application_submitted':
        return <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />;
      case 'signatory_action':
      case 'approval_updated':
        return <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" aria-hidden="true" />;
      case 'financial_updated':
        return <CreditCard className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />;
      default:
        return <Info className="w-4 h-4 text-base-content/50 shrink-0 mt-0.5" aria-hidden="true" />;
    }
  };

  const formatRelativeTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) loadNotifications();
        }}
        className="btn btn-sm btn-ghost hover:bg-base-content/10 text-base-content/70 hover:text-base-content rounded-lg relative p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="notification-dropdown-menu"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="badge badge-error badge-xs absolute -top-1 -right-1 font-bold" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notification-dropdown-menu"
          role="region"
          aria-label="User Notifications"
          className="absolute right-0 mt-2 shadow-2xl bg-base-100 border border-base-content/10 rounded-2xl w-80 sm:w-96 z-50 max-h-[28rem] overflow-hidden flex flex-col focus:outline-none"
        >
          {/* Dropdown Header */}
          <div className="p-3.5 border-b border-base-content/10 bg-base-200/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" aria-hidden="true" />
              <span className="font-bold text-xs uppercase tracking-wider text-base-content">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="badge badge-primary badge-sm font-semibold text-[10px]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 rounded-lg gap-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications Body */}
          <div className="overflow-y-auto flex-1 divide-y divide-base-content/5">
            {notifications.length === 0 ? (
              <div role="status" className="p-8 text-center text-base-content/50 text-xs font-medium">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={(e) => !n.isRead && handleMarkAsRead(n.id, e)}
                  role={!n.isRead ? 'button' : undefined}
                  tabIndex={!n.isRead ? 0 : undefined}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !n.isRead) {
                      e.preventDefault();
                      handleMarkAsRead(n.id, e as unknown as React.MouseEvent);
                    }
                  }}
                  className={`p-3.5 flex items-start gap-3 hover:bg-base-200/40 transition-all ${
                    !n.isRead ? 'bg-primary/5 cursor-pointer' : ''
                  }`}
                >
                  {getNotificationIcon(n.type)}
                  <div className="flex-1 space-y-1">
                    <p className={`text-xs leading-relaxed ${!n.isRead ? 'font-semibold text-base-content' : 'text-base-content/70'}`}>
                      {n.message}
                    </p>
                    <span className="text-[10px] text-base-content/50 block font-mono">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" title="Unread" aria-label="Unread notification" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
