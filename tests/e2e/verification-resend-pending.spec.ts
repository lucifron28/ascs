import { test, expect } from '@playwright/test';

test('student registration awaits administrator approval without email verification', async ({ page }) => {
  const timestamp = Date.now();
  const email = `pending.approval.${timestamp}@example.test`;
  const password = 'TestPassword123!';

  await page.goto('/register');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/student number/i).fill(`STUD-PEND-${timestamp}`);
  await page.getByLabel(/full name/i).fill('Pending Approval Student');
  await page.getByLabel(/academic program/i).selectOption('BSAIS');
  await page.getByLabel(/year level/i).selectOption('1st Year');
  await page.getByLabel(/semester/i).selectOption('1st Semester');
  await page.getByLabel(/section/i).fill('A');
  await page.getByLabel(/^password/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);
  await page.getByRole('button', { name: /create student account/i }).click();

  await expect(page.getByText(/registration submitted/i)).toBeVisible();
  await expect(page.getByText(/waiting for administrator approval/i)).toBeVisible();
  await expect(page.getByText(/email verification link/i)).toHaveCount(0);
  await expect(page.getByText(/verification email notice/i)).toHaveCount(0);

  await page.goto('/login');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();

  await expect(page.locator('.alert-error[role="alert"]')).toContainText(/waiting for administrator approval/i);
  await expect(page.getByRole('button', { name: /resend verification email/i })).toHaveCount(0);
});
