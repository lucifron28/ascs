import { test, expect } from '@playwright/test';

test.describe('Negative Clearance Journey', () => {
  test('Student C sees not_approved status and signatory remarks', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('student.c@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/student/dashboard');

    // Confirm not_approved status & remarks visible
    await expect(page.getByText(/not approved/i).first()).toBeVisible();
    await expect(page.getByText(/operating system concepts/i)).toBeVisible();

    const printBtn = page.getByRole('button', { name: /print|preview|certificate/i });
    if (await printBtn.count() > 0) {
      await expect(printBtn).toBeDisabled();
    }
  });

  test('Student D sees unpaid financial hold and not_approved status', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('student.d@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/student/dashboard');

    await expect(page.getByText(/unpaid/i).first()).toBeVisible();
    await expect(page.getByText(/not approved/i).first()).toBeVisible();

    const printBtn = page.getByRole('button', { name: /print|preview|certificate/i });
    if (await printBtn.count() > 0) {
      await expect(printBtn).toBeDisabled();
    }
  });
});
