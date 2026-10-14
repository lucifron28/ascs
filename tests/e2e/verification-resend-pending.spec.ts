import { test, expect } from '@playwright/test';

test('student can request verification again after initial delivery fails while approval is pending', async ({ page }) => {
  const timestamp = Date.now();
  const email = `verification.pending.${timestamp}@example.test`;
  const password = 'TestPassword123!';

  await page.goto('/register');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/student number/i).fill(`STUD-VERIFY-${timestamp}`);
  await page.getByLabel(/full name/i).fill('Pending Verification Student');
  await page.getByLabel(/academic program/i).selectOption('BSAIS');
  await page.getByLabel(/year level/i).selectOption('1st Year');
  await page.getByLabel(/semester/i).selectOption('1st Semester');
  await page.getByLabel(/section/i).fill('A');
  await page.getByLabel(/^password/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);
  await page.getByRole('button', { name: /create student account/i }).click();

  await expect(page.getByText(/registration submitted/i)).toBeVisible();
  await expect(page.getByText(/initial verification email could not be sent automatically/i)).toBeVisible();

  await page.goto('/login');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();

  await expect(page.locator('.alert-error[role="alert"]')).toContainText(/email verification required/i);
  const resendButton = page.getByRole('button', { name: /resend verification email/i });
  await expect(resendButton).toBeVisible();
  await resendButton.click();
  await expect(page.getByText(/if an unverified student account exists/i)).toBeVisible();
});
