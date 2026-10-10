import { test, expect } from '@playwright/test';

test.describe('Student registration and password visibility', () => {
  test('keeps registration public and exposes accessible show-password controls', async ({ page }) => {
    await page.goto('/register');

    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Create a Student Account' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Academic program')).toBeVisible();

    await expect(page.locator('#register-program option').evaluateAll((options) => options.map((option) => option.value)))
      .resolves.toEqual(['BSAIS', 'BSMA']);
    await expect(page.locator('#register-year-level option').evaluateAll((options) => options.map((option) => option.value)))
      .resolves.toEqual(['1st Year', '2nd Year', '3rd Year', '4th Year']);
    await expect(page.locator('#register-semester option').evaluateAll((options) => options.map((option) => option.value)))
      .resolves.toEqual(['1st Semester', '2nd Semester']);

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

  test('Admin Create Student Account exposes the same canonical profile options', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL('**/admin/dashboard');

    await page.getByRole('button', { name: /users/i }).click();
    await page.getByRole('button', { name: /create student account/i }).click();
    const dialog = page.getByRole('dialog', { name: /create student account/i });
    await expect(dialog).toBeVisible();
    await expect(page.locator('#create-student-year')).toHaveJSProperty('tagName', 'SELECT');
    await expect(page.locator('#create-student-program option').evaluateAll((options) => options.map((option) => option.value)))
      .resolves.toEqual(['BSAIS', 'BSMA']);
    await expect(page.locator('#create-student-year option').evaluateAll((options) => options.map((option) => option.value)))
      .resolves.toEqual(['1st Year', '2nd Year', '3rd Year', '4th Year']);
    await expect(page.locator('#create-student-semester option').evaluateAll((options) => options.map((option) => option.value)))
      .resolves.toEqual(['1st Semester', '2nd Semester']);
  });
});
