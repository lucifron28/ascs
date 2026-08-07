import { test, expect } from '@playwright/test';

test.describe('Admin and Dean Reports E2E Acceptance', () => {
  test('Admin can view reports dashboard with financial summary', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/admin\/dashboard/);

    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { name: /institution clearance/i })).toBeVisible();
    await expect(page.getByText(/financial verification summary/i)).toBeVisible();
  });

  test('Dean can view academic reports dashboard with financial summary excluded', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('dean@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/dean\/dashboard/);

    await page.goto('/dean/reports');
    await expect(page.getByRole('heading', { name: /academic clearance reports/i })).toBeVisible();

    await expect(page.getByText(/financial verification summary/i)).not.toBeVisible();
  });
});
