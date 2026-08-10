import { test, expect } from '@playwright/test';

test.describe('Emulator-only demo account picker', () => {
  test('shows the organized selector, inventory, selected details, and non-submitting credential fill', async ({ page }) => {
    await page.goto('/login');

    const picker = page.getByLabel('Demo account');
    await expect(picker).toBeVisible();
    await expect(picker.locator('optgroup')).toHaveCount(4);
    await expect(picker.locator('option')).toHaveCount(16);
    await expect(picker.locator('option')).toContainText([
      'Select a demo account...',
      'Student A — Approved',
      'Student G — Live Journey',
      'Librarian',
      'OSA Coordinator',
      'Guidance Counselor',
      'Area Chair',
      'Adviser',
      'Accountant',
      'Dean',
      'System Administrator',
    ]);

    await picker.selectOption('student-g');
    const details = page.locator('#demo-account-details');
    await expect(details.getByText('Student G — Live Journey', { exact: true })).toBeVisible();
    await expect(details.getByText(/FSM — Food Service Management/i)).toBeVisible();
    await expect(details.getByText(/complete end-to-end defense workflow/i)).toBeVisible();

    await page.getByRole('button', { name: 'Fill Demo Credentials' }).click();
    await expect(page.getByLabel(/email address/i)).toHaveValue('student.g@example.test');
    await expect(page.getByLabel(/password/i)).toHaveValue('password123');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('keeps the emulator helper separate from the credential fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/Demo \/ Emulator Only — Fictional Data/i)).toBeVisible();
    await page.getByLabel('Demo account').selectOption('accountant');
    const details = page.locator('#demo-account-details');
    await expect(details).toBeVisible();
    await expect(details).toContainText('Accountant');
    await expect(details).toContainText('accountant@example.test');
    await expect(details).not.toContainText('password123');
  });
});
