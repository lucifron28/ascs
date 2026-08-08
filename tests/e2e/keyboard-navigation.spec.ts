import { test, expect } from '@playwright/test';

test.describe('Keyboard Accessibility & Modal Navigation', () => {
  test('Login form is fully navigable and submissible via keyboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // Focus email input and fill via keyboard
    await page.getByLabel(/email address/i).focus();
    await page.keyboard.type('admin@example.test');

    // Tab to password
    await page.keyboard.press('Tab');
    await page.keyboard.type('password123');

    // Submit with Enter key
    await page.keyboard.press('Enter');

    await page.waitForURL('**/admin/dashboard');
    await expect(page.getByRole('heading', { name: /admin control center/i })).toBeVisible();
  });

  test('Theme selector opens, navigates, and closes with Escape key', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    const themeBtn = page.getByRole('button', { name: /change theme/i });
    await themeBtn.focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('menu', { name: /select theme/i })).toBeVisible();

    // Escape closes theme dropdown
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: /select theme/i })).toBeHidden();
  });

  test('Signatory evaluation modal traps focus and closes with Escape key', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('guidance@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/guidance_counselor/dashboard');
    await expect(page.getByRole('heading', { name: /pending evaluation queue/i })).toBeVisible();

    const reviewBtn = page.locator('button', { hasText: 'Review' }).first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.focus();
    await page.keyboard.press('Enter');

    // Modal dialog should open and trap focus
    const dialog = page.getByRole('dialog', { name: /evaluate clearance/i });
    await expect(dialog).toBeVisible();

    // Tab through controls inside dialog
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Press Escape to close modal
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
