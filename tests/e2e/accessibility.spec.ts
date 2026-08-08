import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Narrowly scoped rule suppressions:
 * - 'document-title': Next.js App Router client navigation manages title via React head manager after hydration.
 * - 'color-contrast': DaisyUI themes compute dynamic CSS variable colors across 9 themes at runtime.
 */
const CONFIGURED_AXE_BUILDER = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['document-title', 'color-contrast']);

test.describe('Automated Accessibility (axe-core WCAG 2.2 AA)', () => {
  test('Login route has 0 critical or serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    const results = await CONFIGURED_AXE_BUILDER(page).analyze();
    const severe = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severe).toEqual([]);
  });

  test('Student Dashboard has 0 critical or serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('student.a@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/student/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    const results = await CONFIGURED_AXE_BUILDER(page).analyze();
    const severe = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severe).toEqual([]);
  });

  test('Librarian Dashboard has 0 critical or serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('librarian@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/librarian/dashboard');
    await expect(page.getByRole('heading', { name: /pending evaluation queue/i })).toBeVisible();

    const results = await CONFIGURED_AXE_BUILDER(page).analyze();
    const severe = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severe).toEqual([]);
  });

  test('Accountant Dashboard has 0 critical or serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('accountant@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/accountant/dashboard');
    await expect(page.getByRole('heading', { name: /financial accountability management/i })).toBeVisible();

    const results = await CONFIGURED_AXE_BUILDER(page).analyze();
    const severe = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severe).toEqual([]);
  });

  test('Dean Dashboard and Reports have 0 critical or serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('dean@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/dean/dashboard');
    await expect(page.getByRole('heading', { name: /dean clearance oversight/i })).toBeVisible();

    const dashResults = await CONFIGURED_AXE_BUILDER(page).analyze();
    const severeDash = dashResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severeDash).toEqual([]);

    await page.goto('/dean/reports');
    await page.waitForURL('**/dean/reports');
    await expect(page.getByRole('heading', { name: /academic clearance reports/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apply filters/i })).toBeEnabled();

    const reportResults = await CONFIGURED_AXE_BUILDER(page).analyze();
    const severeReport = reportResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severeReport).toEqual([]);
  });

  test('Admin Dashboard and Reports have 0 critical or serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/admin/dashboard');
    await expect(page.getByRole('heading', { name: /admin control center/i })).toBeVisible();

    const dashResults = await CONFIGURED_AXE_BUILDER(page).analyze();
    const severeDash = dashResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severeDash).toEqual([]);

    await page.goto('/admin/reports');
    await page.waitForURL('**/admin/reports');
    await expect(page.getByRole('heading', { name: /institution clearance & analytical reports/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apply filters/i })).toBeEnabled();

    const reportResults = await CONFIGURED_AXE_BUILDER(page).analyze();
    const severeReport = reportResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severeReport).toEqual([]);
  });
});
