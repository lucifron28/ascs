import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const RUN_AXE = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);

async function assertZeroSevereViolations(page: Page) {
  const results = await RUN_AXE(page).analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
  expect(severe).toEqual([]);
}

test.describe('Automated Accessibility (axe-core WCAG 2.2 AA)', () => {
  test('1. Unauthenticated routes (/login & /change-password) have 0 critical/serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await assertZeroSevereViolations(page);

    await page.getByLabel(/email address/i).fill('student.e@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/change-password');
    await expect(page.getByRole('heading', { name: /mandatory password change/i })).toBeVisible();
    await assertZeroSevereViolations(page);
  });

  test('2. Student Dashboard & Printable Clearance route have 0 critical/serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('student.a@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/student/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await assertZeroSevereViolations(page);

    await page.goto('/student/clearance/app-student-a/print');
    await expect(page.getByRole('heading', { name: /student clearance certificate — prototype \/ mvp/i })).toBeVisible();
    await assertZeroSevereViolations(page);
  });

  test('3. Signatory Dashboard & Review Modal have 0 critical/serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('guidance@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/guidance_counselor/dashboard');
    await expect(page.getByRole('heading', { name: /pending evaluation queue/i })).toBeVisible();
    await assertZeroSevereViolations(page);

    const reviewBtn = page.locator('button', { hasText: 'Review' }).first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    const dialog = page.getByRole('dialog', { name: /evaluate clearance/i });
    await expect(dialog).toBeVisible();
    await assertZeroSevereViolations(page);
  });

  test('4. Accountant Dashboard & Update Modal have 0 critical/serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('accountant@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/accountant/dashboard');
    await expect(page.getByRole('heading', { name: /financial accountability management/i })).toBeVisible();
    await assertZeroSevereViolations(page);

    const updateBtn = page.locator('button', { hasText: 'Update' }).first();
    await expect(updateBtn).toBeVisible();
    await updateBtn.click();

    const dialog = page.getByRole('dialog', { name: /update financial account/i });
    await expect(dialog).toBeVisible();
    await assertZeroSevereViolations(page);
  });

  test('5. Dean Dashboard & Reports have 0 critical/serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('dean@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/dean/dashboard');
    await expect(page.getByRole('heading', { name: /dean clearance oversight/i })).toBeVisible();
    await assertZeroSevereViolations(page);

    await page.goto('/dean/reports');
    await page.waitForURL('**/dean/reports');
    await expect(page.getByRole('heading', { name: /academic clearance reports/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apply filters/i })).toBeEnabled();
    await assertZeroSevereViolations(page);
  });

  test('6. Admin Dashboard, Modal, Reports & Multi-Theme have 0 critical/serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/admin/dashboard');
    // Switch to Users tab to reveal Create Student Account button
    const usersTab = page.getByRole('button', { name: /users/i });
    await expect(usersTab).toBeVisible();
    await usersTab.click();

    const createStudentBtn = page.getByRole('button', { name: /create student account/i });
    await expect(createStudentBtn).toBeVisible();
    await createStudentBtn.click();
    const dialog = page.getByRole('dialog', { name: /create student account/i });
    await expect(dialog).toBeVisible();
    await assertZeroSevereViolations(page);

    await page.getByRole('button', { name: /close dialog/i }).click();

    await page.goto('/admin/reports');
    await page.waitForURL('**/admin/reports');
    await expect(page.getByRole('heading', { name: /institution clearance & analytical reports/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apply filters/i })).toBeEnabled();
    await assertZeroSevereViolations(page);

    // Multi-Theme contrast scan across dark, light, corporate, night
    const THEMES = ['dark', 'light', 'corporate', 'night'];
    for (const theme of THEMES) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await assertZeroSevereViolations(page);
    }
  });
});
