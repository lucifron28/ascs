/**
 * Institutional audit timestamp utilities for PKM ASCS.
 *
 * Canonical PKM institutional timezone is Asia/Manila (UTC+08:00).
 * Historical and newly recorded database timestamps are stored in UTC.
 * Display formatting converts UTC timestamps to Asia/Manila across all environments
 * (local developer workstations, CI, and serverless hosting such as Vercel).
 */

export const AUDIT_TIMEZONE = 'Asia/Manila' as const;
export const AUDIT_LOCALE = 'en-PH' as const;

/**
 * Standard formatter for audit log timestamps in Asia/Manila timezone.
 * Output format: "Sep 5, 2026, 03:11 PM"
 */
export const auditDateTimeFormatter = new Intl.DateTimeFormat(AUDIT_LOCALE, {
  timeZone: AUDIT_TIMEZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

/**
 * Parse an audit timestamp value safely into a valid JavaScript Date.
 *
 * Handles:
 * - Date instances
 * - Numeric epoch milliseconds
 * - Firestore Timestamp objects ({ seconds, nanoseconds } or { toDate() })
 * - ISO strings with timezone (e.g. "2026-09-05T07:11:00.000Z")
 * - Strings without timezone (treated as UTC per database convention to avoid ambiguous local parsing)
 *
 * Returns null if the value is null, undefined, unparseable, or invalid.
 */
export function parseAuditDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'object') {
    const obj = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof obj.toDate === 'function') {
      try {
        const d = obj.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    if (typeof obj.seconds === 'number') {
      const ms = obj.seconds * 1000 + Math.floor((obj.nanoseconds || 0) / 1e6);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    // Check if the string matches an ISO/date-time string lacking an explicit timezone offset or Z
    // e.g. "2026-09-05T07:11:00", "2026-09-05 07:11:00", "2026-09-05T07:11:00.000"
    const hasTimezone = /Z|[+-]\d{2}(:?\d{2})?$/i.test(trimmed);
    let normalized = trimmed;
    if (!hasTimezone && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
      normalized = trimmed.replace(' ', 'T') + 'Z';
    }

    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Format an audit log timestamp in the canonical Asia/Manila timezone.
 *
 * @param value - Timestamp representation (ISO string, Date, Firestore Timestamp, or number)
 * @param fallback - Fallback string if value is null, undefined, or unparseable (default: 'Invalid Date')
 * @returns Formatted timestamp string, e.g. "Sep 5, 2026, 03:11 PM"
 */
export function formatAuditTimestamp(value: unknown, fallback = 'Invalid Date'): string {
  const date = parseAuditDate(value);
  if (!date) {
    return fallback;
  }
  return auditDateTimeFormatter.format(date);
}
