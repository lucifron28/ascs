import { test, expect } from '@playwright/test';

test.describe('Admin and Dean Reports E2E Acceptance', () => {
  test('Admin can view reports dashboard with financial summary', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/admin\/dashboard/);

    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { name: /institution clearance/i })).toBeVisible();
    await expect(page.getByText(/financial verification summary/i)).toBeVisible();
    await expect(page.getByRole('cell', { name: /BSAIS.*Accounting Information System/i })).toBeVisible();

    // Assert exactly 4 summary cards are present and Not Approved is absent
    const cardTitles = page.locator('span.uppercase');
    await expect(cardTitles.filter({ hasText: 'Total Applications' })).toBeVisible();
    await expect(cardTitles.filter({ hasText: 'Fully Approved' })).toBeVisible();
    await expect(cardTitles.filter({ hasText: 'Pending Review' })).toBeVisible();
    await expect(cardTitles.filter({ hasText: 'Completion Rate' })).toBeVisible();
    await expect(cardTitles.filter({ hasText: 'Not Approved' })).toHaveCount(0);

    // Filter dropdown must not contain Not Approved option
    await expect(page.locator('#report-filter-status option[value="not_approved"]')).toHaveCount(0);

    // Tables must not contain Not Approved column
    await expect(page.locator('th:has-text("Not Approved")')).toHaveCount(0);
  });

  test('Dean can view academic reports dashboard with financial summary excluded', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('dean@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/dean\/dashboard/);

    await page.goto('/dean/reports');
    await expect(page.getByRole('heading', { name: /academic clearance reports/i })).toBeVisible();

    await expect(page.getByText(/financial verification summary/i)).not.toBeVisible();
    await expect(page.getByRole('cell', { name: /BSAIS.*Accounting Information System/i })).toBeVisible();

    // Assert exactly 4 summary cards are present and Not Approved is absent in Dean reports
    const cardTitles = page.locator('span.uppercase');
    await expect(cardTitles.filter({ hasText: 'Total Applications' })).toBeVisible();
    await expect(cardTitles.filter({ hasText: 'Fully Approved' })).toBeVisible();
    await expect(cardTitles.filter({ hasText: 'Pending Review' })).toBeVisible();
    await expect(cardTitles.filter({ hasText: 'Completion Rate' })).toBeVisible();
    await expect(cardTitles.filter({ hasText: 'Not Approved' })).toHaveCount(0);
    await expect(page.locator('th:has-text("Not Approved")')).toHaveCount(0);
  });
});
