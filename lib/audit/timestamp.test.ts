import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_TIMEZONE,
  AUDIT_LOCALE,
  auditDateTimeFormatter,
  parseAuditDate,
  formatAuditTimestamp,
} from './timestamp';

test('1. Constants match canonical PKM institutional configuration', () => {
  assert.equal(AUDIT_TIMEZONE, 'Asia/Manila');
  assert.equal(AUDIT_LOCALE, 'en-PH');
  assert.equal(auditDateTimeFormatter.resolvedOptions().timeZone, 'Asia/Manila');
});

test('2. Formats UTC timestamp into Philippine Standard Time (Asia/Manila)', () => {
  // Client bug example: 07:11 AM UTC was displayed instead of 03:11 PM PST
  const input = '2026-09-05T07:11:00.000Z';
  const result = formatAuditTimestamp(input);
  assert.equal(result, 'Sep 5, 2026, 03:11 PM');
});

test('3. Correctly handles date boundary crossing into the next day in Asia/Manila', () => {
  // 20:30 UTC on Sep 5 crosses the midnight boundary to 04:30 AM on Sep 6 in UTC+8
  const input = '2026-09-05T20:30:00.000Z';
  const result = formatAuditTimestamp(input);
  assert.equal(result, 'Sep 6, 2026, 04:30 AM');
});

test('4. Correctly handles date boundary crossing into the previous day in Asia/Manila', () => {
  // 16:15 UTC on Dec 31, 2025 crosses midnight to Jan 1, 2026 00:15 AM in UTC+8
  const input = '2025-12-31T16:15:00.000Z';
  const result = formatAuditTimestamp(input);
  assert.equal(result, 'Jan 1, 2026, 12:15 AM');
});

test('5. Non-Philippine server/system timezones still format in Asia/Manila', () => {
  const originalTz = process.env.TZ;
  const simulatedTimezones = [
    'UTC',
    'America/New_York',
    'Europe/London',
    'Asia/Tokyo',
    'Pacific/Honolulu',
    'Australia/Sydney',
  ];

  try {
    for (const tz of simulatedTimezones) {
      process.env.TZ = tz;
      const formatted = formatAuditTimestamp('2026-09-05T07:11:00.000Z');
      assert.equal(
        formatted,
        'Sep 5, 2026, 03:11 PM',
        `Failed under simulated system timezone ${tz}`
      );

      const boundaryFormatted = formatAuditTimestamp('2026-09-05T20:30:00.000Z');
      assert.equal(
        boundaryFormatted,
        'Sep 6, 2026, 04:30 AM',
        `Failed boundary under simulated system timezone ${tz}`
      );
    }
  } finally {
    process.env.TZ = originalTz;
  }
});

test('6. Formats native Date instance without mutating it', () => {
  const date = new Date('2026-09-05T07:11:00.000Z');
  const originalTime = date.getTime();
  const result = formatAuditTimestamp(date);
  assert.equal(result, 'Sep 5, 2026, 03:11 PM');
  assert.equal(date.getTime(), originalTime, 'Date instance must not be mutated');
});

test('7. Formats numeric epoch milliseconds', () => {
  const epochMs = Date.parse('2026-09-05T07:11:00.000Z');
  const result = formatAuditTimestamp(epochMs);
  assert.equal(result, 'Sep 5, 2026, 03:11 PM');
});

test('8. Formats Firestore Timestamp object with seconds and nanoseconds', () => {
  const firestoreTimestamp = {
    seconds: Math.floor(Date.parse('2026-09-05T07:11:00.000Z') / 1000),
    nanoseconds: 0,
  };
  const result = formatAuditTimestamp(firestoreTimestamp);
  assert.equal(result, 'Sep 5, 2026, 03:11 PM');
});

test('9. Formats Firestore Timestamp object with toDate() method', () => {
  const firestoreDocTimestamp = {
    toDate: () => new Date('2026-09-05T07:11:00.000Z'),
  };
  const result = formatAuditTimestamp(firestoreDocTimestamp);
  assert.equal(result, 'Sep 5, 2026, 03:11 PM');
});

test('10. Normalizes ambiguous strings without timezone as UTC per database convention', () => {
  // When a database record omits the timezone, it represents UTC
  const ambiguousT = '2026-09-05T07:11:00';
  assert.equal(formatAuditTimestamp(ambiguousT), 'Sep 5, 2026, 03:11 PM');

  const ambiguousSpace = '2026-09-05 07:11:00';
  assert.equal(formatAuditTimestamp(ambiguousSpace), 'Sep 5, 2026, 03:11 PM');
});

test('11. Formats ISO strings with explicit offset correctly', () => {
  // 15:11 in UTC+08:00 is 15:11 Asia/Manila
  const withOffset = '2026-09-05T15:11:00+08:00';
  assert.equal(formatAuditTimestamp(withOffset), 'Sep 5, 2026, 03:11 PM');

  // 03:11 in UTC-04:00 is 07:11 UTC, which is 15:11 Asia/Manila
  const withDifferentOffset = '2026-09-05T03:11:00-04:00';
  assert.equal(formatAuditTimestamp(withDifferentOffset), 'Sep 5, 2026, 03:11 PM');
});

test('12. Omits seconds from visual display style', () => {
  const result = formatAuditTimestamp('2026-09-05T07:11:45.123Z');
  assert.equal(result, 'Sep 5, 2026, 03:11 PM');
  assert.equal(result.includes(':45'), false, 'Seconds must be omitted');
});

test('13. Handles null, undefined, empty, and invalid inputs gracefully', () => {
  assert.equal(formatAuditTimestamp(null), 'Invalid Date');
  assert.equal(formatAuditTimestamp(undefined), 'Invalid Date');
  assert.equal(formatAuditTimestamp(''), 'Invalid Date');
  assert.equal(formatAuditTimestamp('   '), 'Invalid Date');
  assert.equal(formatAuditTimestamp('not-a-date'), 'Invalid Date');
  assert.equal(formatAuditTimestamp({ invalid: 'object' }), 'Invalid Date');

  // Custom fallback string
  assert.equal(formatAuditTimestamp(null, '--'), '--');
  assert.equal(formatAuditTimestamp(undefined, 'N/A'), 'N/A');
  assert.equal(formatAuditTimestamp('not-a-date', 'Unknown'), 'Unknown');
});

test('14. parseAuditDate produces valid UTC Date or null', () => {
  const date = parseAuditDate('2026-09-05T07:11:00.000Z');
  assert.ok(date instanceof Date);
  assert.equal(date.toISOString(), '2026-09-05T07:11:00.000Z');

  assert.equal(parseAuditDate(null), null);
  assert.equal(parseAuditDate('not-a-valid-date'), null);
});
