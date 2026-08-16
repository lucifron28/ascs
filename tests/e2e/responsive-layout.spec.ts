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
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    });

    test(`Signatory & Accountant Dashboards have zero page-level horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');
      await page.getByLabel(/email address/i).fill('guidance@example.test');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL(/\/guidance_counselor\/dashboard/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: /pending evaluation queue/i })).toBeVisible();

      const hasSigOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasSigOverflow).toBe(false);
      if (vp.width < 768) {
        const menuBtn = page.getByRole('button', { name: /open mobile menu/i });
        await expect(menuBtn).toBeVisible();
        await menuBtn.click();
      }

      const logoutBtn = page.getByRole('button', { name: /logout/i });
      await expect(logoutBtn).toBeVisible();
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

      await page.getByLabel(/email address/i).fill('accountant@example.test');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL(/\/accountant\/dashboard/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: /financial accountability management/i })).toBeVisible();

      const hasAccOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasAccOverflow).toBe(false);
    });

    test(`Dean Dashboard & Reports have zero page-level horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');
      await page.getByLabel(/email address/i).fill('dean@example.test');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL(/\/dean\/dashboard/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: /dean clearance queue/i })).toBeVisible();
      const hasDeanOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasDeanOverflow).toBe(false);

      await page.goto('/dean/reports');
      await expect(page).toHaveURL(/\/dean\/reports/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: /academic clearance reports/i })).toBeVisible();
      const hasReportsOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasReportsOverflow).toBe(false);
    });

    test(`Admin Dashboard & Reports have zero page-level horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');
      await page.getByLabel(/email address/i).fill('admin@example.test');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
      const hasOverflowDashboard = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflowDashboard).toBe(false);

      await page.goto('/admin/reports');
      await expect(page).toHaveURL(/\/admin\/reports/, { timeout: 10_000 });
      const hasOverflowReports = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflowReports).toBe(false);
    });
  }

  test('Signatory Review dialog remains usable at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('guidance@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/\/guidance_counselor\/dashboard/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /pending evaluation queue/i })).toBeVisible();

    const reviewBtn = page.locator('button', { hasText: 'Review' }).first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    const dialog = page.getByRole('dialog', { name: /evaluate clearance requirement/i });
    await expect(dialog).toBeVisible();

    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(320);

    const dialogBody = dialog.locator('div.overflow-y-auto').first();
    await expect(dialogBody).toBeVisible();
    const scrollMetrics = await dialogBody.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(scrollMetrics.overflowY).toBe('auto');
    expect(scrollMetrics.scrollHeight).toBeGreaterThanOrEqual(scrollMetrics.clientHeight);

    for (const label of [/mark not approved/i, /mark pending/i, /approve clearance/i]) {
      const action = dialog.getByRole('button', { name: label });
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeVisible();
    }
  });
});
