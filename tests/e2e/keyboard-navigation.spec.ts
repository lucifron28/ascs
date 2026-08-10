import { test, expect, type Page } from '@playwright/test';

async function isFocusInsideDialog(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return Boolean(dialog && dialog.contains(document.activeElement));
  });
}

test.describe('Keyboard Accessibility & Modal Navigation', () => {
  test('1. Login form is fully navigable and submissible via keyboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await page.getByLabel(/email address/i).focus();
    await page.keyboard.type('admin@example.test');

    await page.keyboard.press('Tab');
    await page.keyboard.type('password123');

    await page.keyboard.press('Enter');

    await page.waitForURL('**/admin/dashboard');
    await expect(page.getByRole('heading', { name: /admin control center/i })).toBeVisible();
  });

  test('2. Theme selector opens, selects theme via keyboard, and restores focus', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    const themeBtn = page.getByRole('button', { name: /change theme/i });
    await themeBtn.focus();
    await page.keyboard.press('Enter');

    const themeMenu = page.getByRole('menu', { name: /select theme/i });
    await expect(themeMenu).toBeVisible();

    // Select ASCS Light via keyboard, without pointer activation.
    const lightOption = page.getByRole('menuitem', { name: /ascs light/i });
    await lightOption.focus();
    await page.keyboard.press('Enter');

    // Verify document theme changed
    const currentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(currentTheme).toBe('ascs-light');

    // Menu closes and focus is restored to theme button
    await expect(themeMenu).toBeHidden();
    await expect(themeBtn).toBeFocused();
  });

  test('3. NotificationDropdown opens and closes via keyboard with focus restoration', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/admin/dashboard');

    const notifBtn = page.getByRole('button', { name: /notifications/i });
    await notifBtn.focus();
    await page.keyboard.press('Enter');

    const notifRegion = page.getByRole('region', { name: /user notifications/i });
    await expect(notifRegion).toBeVisible();

    // The deterministic Admin fixture intentionally has no notifications, so
    // this test records trigger/open/close/focus restoration only. Unread-item
    // activation is covered by the component's keyboard semantics/manual QA.
    await expect(notifRegion.getByRole('status')).toHaveText(/no notifications yet/i);

    // Escape closes dropdown and restores focus to trigger button
    await page.keyboard.press('Escape');
    await expect(notifRegion).toBeHidden();
    await expect(notifBtn).toBeFocused();
  });

  test('4. Signatory evaluation modal traps focus, wraps Tab/Shift+Tab, and restores focus', async ({ page }) => {
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

    const dialog = page.getByRole('dialog', { name: /evaluate clearance/i });
    await expect(dialog).toBeVisible();

    // Forward Tab wrapping test: focus last element then press Tab
    const lastFocusable = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      const focusables = modal?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables && focusables.length > 0) {
        focusables[focusables.length - 1].focus();
        return focusables[focusables.length - 1].textContent?.trim() || focusables[focusables.length - 1].tagName;
      }
      return null;
    });
    expect(lastFocusable).toBeTruthy();

    await page.keyboard.press('Tab');
    const firstFocusedAfterTab = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      const focusables = modal?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return focusables && focusables.length > 0 && document.activeElement === focusables[0];
    });
    expect(firstFocusedAfterTab).toBe(true);

    // Backward Shift+Tab wrapping test: focus first element then press Shift+Tab
    await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      const focusables = modal?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables && focusables.length > 0) {
        focusables[0].focus();
      }
    });

    await page.keyboard.press('Shift+Tab');
    const lastFocusedAfterShiftTab = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      const focusables = modal?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return focusables && focusables.length > 0 && document.activeElement === focusables[focusables.length - 1];
    });
    expect(lastFocusedAfterShiftTab).toBe(true);

    // Escape key closes modal and restores focus to Review trigger button
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(reviewBtn).toBeFocused();
  });

  test('5. Accountant financial modal traps focus and restores focus to Update trigger', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('accountant@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/accountant/dashboard');

    const updateBtn = page.locator('button', { hasText: 'Update' }).first();
    await expect(updateBtn).toBeVisible();
    await updateBtn.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: /update financial account/i });
    await expect(dialog).toBeVisible();

    await expect.poll(() => isFocusInsideDialog(page)).toBe(true);
    await page.keyboard.press('Tab');
    await expect.poll(() => isFocusInsideDialog(page)).toBe(true);

    // Escape key closes modal and restores focus to Update button
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(updateBtn).toBeFocused();
  });

  test('6. Admin account modal traps focus and restores focus on close', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/admin/dashboard');

    const usersTab = page.getByRole('button', { name: /users/i });
    await expect(usersTab).toBeVisible();
    await usersTab.click();

    const createBtn = page.getByRole('button', { name: /create student account/i });
    await expect(createBtn).toBeVisible();
    await createBtn.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: /create student account/i });
    await expect(dialog).toBeVisible();

    await expect.poll(() => isFocusInsideDialog(page)).toBe(true);
    await page.keyboard.press('Tab');
    await expect.poll(() => isFocusInsideDialog(page)).toBe(true);

    // Escape closes modal and restores focus to Create button
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(createBtn).toBeFocused();
  });

  test('7. RoleHeader exposes Notifications, ThemeSelector, and Logout across roles at desktop', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('student.a@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL('**/student/dashboard');

    await expect(page.getByRole('button', { name: /notifications/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /change theme/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL('**/admin/dashboard');

    await expect(page.getByRole('button', { name: /notifications/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /change theme/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /reports/i })).toBeVisible();
  });

  test('8. RoleHeader exposes Notifications in header and Theme/Logout inside mobile menu at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/admin/dashboard');

    await expect(page.getByRole('button', { name: /notifications/i })).toBeVisible();

    const menuBtn = page.getByRole('button', { name: /open mobile menu/i });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    await expect(page.getByRole('navigation', { name: /mobile navigation/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /change theme/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: /mobile navigation/i })).toBeHidden();
  });
});
