import { test, expect } from '@playwright/test';

test.describe('Audit Log Timestamp Timezone Verification', () => {
  test('displays audit log timestamps in Asia/Manila even when browser timezone is America/New_York', async ({
    browser,
  }) => {
    // Emulate a client browser running in New York (UTC-04:00/05:00)
    const context = await browser.newContext({
      timezoneId: 'America/New_York',
    });
    const page = await context.newPage();

    try {
      await page.goto('/login');
      await page.getByLabel(/email address/i).fill('admin@example.test');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL('**/admin/dashboard');

      // Wait for initial data loading to populate audit logs count
      const auditTab = page.getByRole('button', { name: /audit logs \([1-9]\d*\)/i });
      await expect(auditTab).toBeVisible({ timeout: 15000 });
      await auditTab.click();

      // Ensure the table rows are populated with actual log data
      const table = page.locator('table');
      await expect(table).toBeVisible();
      await expect(page.getByText('No audit log entries recorded yet.')).not.toBeVisible();

      // Seeded audit logs were recorded at 2026-01-15T09:00:00.000Z
      // In UTC, this would display as 09:00 AM.
      // In America/New_York, this would display as 04:00 AM.
      // In Asia/Manila (PST, UTC+08:00), this MUST display as 05:00 PM.
      const timestampCells = page.locator('tbody tr td:first-child');
      await expect(timestampCells.first()).toBeVisible();

      const timestamps = await timestampCells.allTextContents();
      expect(timestamps.length).toBeGreaterThanOrEqual(1);

      for (const ts of timestamps) {
        // Assert absence of UTC or New York timezone leakage
        expect(ts).not.toContain('09:00 AM');
        expect(ts).not.toContain('04:00 AM');
        // Assert presence of canonical Asia/Manila formatted timestamp
        expect(ts).toMatch(/Jan 15, 2026, 05:00 PM|Sep 5, 2026/);
      }
    } finally {
      await context.close();
    }
  });

  test('displays audit log timestamps in Asia/Manila even when browser timezone is UTC', async ({
    browser,
  }) => {
    // Emulate a client browser or server environment running in UTC
    const context = await browser.newContext({
      timezoneId: 'UTC',
    });
    const page = await context.newPage();

    try {
      await page.goto('/login');
      await page.getByLabel(/email address/i).fill('admin@example.test');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL('**/admin/dashboard');

      // Wait for initial data loading to populate audit logs count
      const auditTab = page.getByRole('button', { name: /audit logs \([1-9]\d*\)/i });
      await expect(auditTab).toBeVisible({ timeout: 15000 });
      await auditTab.click();

      const table = page.locator('table');
      await expect(table).toBeVisible();
      await expect(page.getByText('No audit log entries recorded yet.')).not.toBeVisible();

      const timestampCells = page.locator('tbody tr td:first-child');
      await expect(timestampCells.first()).toBeVisible();

      const timestamps = await timestampCells.allTextContents();
      expect(timestamps.length).toBeGreaterThanOrEqual(1);

      for (const ts of timestamps) {
        expect(ts).not.toContain('09:00 AM'); // UTC leakage
        expect(ts).toMatch(/Jan 15, 2026, 05:00 PM|Sep 5, 2026/);
      }
    } finally {
      await context.close();
    }
  });
});
