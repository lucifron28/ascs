import { test, expect } from '@playwright/test';

test.describe('Student registration and password visibility', () => {
  test('keeps registration public and exposes accessible show-password controls', async ({ page }) => {
    await page.goto('/register');

    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Create a Student Account' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Academic program')).toBeVisible();

    const password = page.locator('#register-password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).first().click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide password' }).first()).toBeVisible();

    const confirmPassword = page.locator('#register-confirm-password');
    await expect(confirmPassword).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).last().click();
    await expect(confirmPassword).toHaveAttribute('type', 'text');
  });

  test('links the existing login form to student registration and supports password visibility', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('link', { name: 'Create a student account' })).toHaveAttribute('href', '/register');
    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
  });
});
