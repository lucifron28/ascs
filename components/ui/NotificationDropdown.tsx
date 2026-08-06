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

  const loadNotifications = async () => {
    try {
      const res = await fetchUserNotificationsAction();
      if (isMounted.current && res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    loadNotifications();

    // Poll every 30 seconds for background notification updates
    const interval = setInterval(loadNotifications, 30000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await markNotificationAsReadAction({ notificationId: id });
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await markAllNotificationsAsReadAction();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'approval_updated':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'financial_updated':
        return <CreditCard className="w-4 h-4 text-accent shrink-0" />;
      case 'submission':
        return <FileText className="w-4 h-4 text-primary shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-info shrink-0" />;
    }
  };

  const formatRelativeTime = (timeStr: string) => {
    const now = new Date();
    const date = new Date(timeStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="dropdown dropdown-end">
      <button
        tabIndex={0}
        onClick={() => {
          setIsOpen(!isOpen);
          loadNotifications();
        }}
        className="btn btn-sm btn-ghost hover:bg-base-content/10 text-base-content/70 hover:text-base-content rounded-lg relative p-2"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="badge badge-error badge-xs absolute -top-1 -right-1 font-bold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <div
        tabIndex={0}
        className="dropdown-content menu p-0 shadow-2xl bg-base-100 border border-base-content/10 rounded-2xl w-80 sm:w-96 z-50 mt-2 max-h-[28rem] overflow-hidden flex flex-col"
      >
        {/* Dropdown Header */}
        <div className="p-3.5 border-b border-base-content/10 bg-base-200/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
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
              onClick={handleMarkAllRead}
              disabled={loading}
              className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 rounded-lg gap-1 text-[11px]"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>

        {/* Notifications Body */}
        <div className="overflow-y-auto flex-1 divide-y divide-base-content/5">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-base-content/50 text-xs">
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={(e) => !n.isRead && handleMarkAsRead(n.id, e)}
                className={`p-3.5 flex items-start gap-3 hover:bg-base-200/40 transition-all cursor-pointer ${
                  !n.isRead ? 'bg-primary/5' : ''
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
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" title="Unread" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
