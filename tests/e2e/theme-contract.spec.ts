import { test, expect } from '@playwright/test';

test.describe('Theme contract', () => {
  test('exposes the ASCS light/dark themes and uses the system sans stack', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'ascs-light');
    const loginLogo = page.locator('img[alt="Pamantasan ng Kolehiyo ng Mauban seal"]');
    await expect(loginLogo).toBeVisible();
    await expect(loginLogo).toHaveAttribute('src', /pkmlogo\.png/);

    const fontFamily = await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily);
    expect(fontFamily.toLowerCase()).toContain('system-ui');
    expect(fontFamily.toLowerCase()).not.toContain('times new roman');

    await page.getByRole('button', { name: /change theme/i }).click();
    const themeMenu = page.getByRole('menu', { name: /select theme/i });
    await expect(themeMenu.getByRole('menuitem')).toHaveCount(2);
    await expect(themeMenu.getByRole('menuitem', { name: 'ASCS Light' })).toBeVisible();
    await expect(themeMenu.getByRole('menuitem', { name: 'ASCS Dark' })).toBeVisible();

    const lightBackground = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
    await themeMenu.getByRole('menuitem', { name: 'ASCS Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'ascs-dark');
    await page.waitForTimeout(300);
    const darkBackground = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(darkBackground).not.toBe(lightBackground);

    await page.getByRole('button', { name: /change theme/i }).click();
    await page.getByRole('menuitem', { name: 'ASCS Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'ascs-light');
  });
});
