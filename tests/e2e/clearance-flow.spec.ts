import { test, expect } from '@playwright/test';

test.describe('Normal Clearance Journey', () => {
  test('Student A (Fully Approved) sees approved status & printable certificate button', async ({ page }) => {
    // 1. Student A logs in
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('student.a@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    // 2. Redirect to dashboard
    await page.waitForURL('**/student/dashboard');

    // 3. Confirm approved status and print certificate button
    await expect(page.getByText(/approved/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /print|preview|certificate/i })).toBeEnabled();
  });

  test('Student B (Pending) sees pending status & printable certificate disabled', async ({ page }) => {
    // Student B logs in
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('student.b@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/student/dashboard');

    // Pending status & print button disabled/hidden
    await expect(page.getByText(/pending/i).first()).toBeVisible();
    const printBtn = page.getByRole('button', { name: /print|preview|certificate/i });
    if (await printBtn.count() > 0) {
      await expect(printBtn).toBeDisabled();
    }
  });
});
