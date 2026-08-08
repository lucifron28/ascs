import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: '320x568 (iPhone SE gen 1)', width: 320, height: 568 },
  { name: '375x667 (Mobile Medium)', width: 375, height: 667 },
  { name: '430x932 (Mobile Large)', width: 430, height: 932 },
  { name: '768x1024 (Tablet Portrait)', width: 768, height: 1024 },
  { name: '1280x720 (Desktop 720p)', width: 1280, height: 720 },
  { name: '1440x900 (Desktop Widescreen)', width: 1440, height: 900 },
];

test.describe('Responsive Layout & Horizontal Overflow Audit', () => {
  for (const vp of VIEWPORTS) {
    test(`Login route has zero page-level horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    });

    test(`Student Dashboard has zero page-level horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');
      await page.getByLabel(/email address/i).fill('student.a@example.test');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForURL('**/student/dashboard');
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    });

    test(`Admin Dashboard & Reports have zero page-level horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');
      await page.getByLabel(/email address/i).fill('admin@example.test');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForURL('**/admin/dashboard');
      const hasOverflowDashboard = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflowDashboard).toBe(false);

      await page.goto('/admin/reports');
      await page.waitForURL('**/admin/reports');
      const hasOverflowReports = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflowReports).toBe(false);
    });
  }
});
