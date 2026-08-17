import { test, expect } from '@playwright/test';

test.describe('Mandatory Password Change Journey', () => {
  test('Student E must change temporary password before accessing dashboard', async ({ page }) => {
    // 1. Open /login
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /ASCS PKM/i })).toBeVisible();

    // 2. Sign in as Student E with emulator temporary credentials
    await page.getByLabel(/email address/i).fill('student.e@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    // 3. Confirm redirect to /change-password
    await expect(page).toHaveURL(/change-password/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /mandatory password change/i })).toBeVisible();

    // 4. Attempt direct dashboard navigation and confirm redirect back to /change-password
    await page.goto('/student/dashboard').catch(() => {});
    await expect(page).toHaveURL(/change-password/, { timeout: 15000 });

    // 5. Enter wrong current password and confirm safe error
    await page.getByLabel(/current temporary password/i).fill('WrongPass999');
    await page.getByLabel(/new password/i).first().fill('NewPassword456!');
    await page.getByLabel(/confirm new password/i).fill('NewPassword456!');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.locator('.alert-error')).toBeVisible();

    // 6. Enter correct current password and valid new password
    await page.getByLabel(/current temporary password/i).fill('password123');
    await page.getByLabel(/new password/i).first().fill('NewPassword456!');
    await page.getByLabel(/confirm new password/i).fill('NewPassword456!');
    await page.getByRole('button', { name: /update password/i }).click();

    // 7. Confirm redirect to /login
    await expect(page).toHaveURL(/login/, { timeout: 15000 });

    // 8. Sign in with the new password
    await page.getByLabel(/email address/i).fill('student.e@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('NewPassword456!');
    await page.getByRole('button', { name: /log in/i }).click();

    // 9. Confirm student dashboard loads
    await expect(page).toHaveURL(/student\/dashboard/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });
});
