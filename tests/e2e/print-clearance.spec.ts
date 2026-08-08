import { test, expect } from '@playwright/test';

test.describe('Printable Clearance Certificate QA', () => {
  test('Student A can view and print prototype clearance record', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('student.a@example.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/student/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    // Click Print Clearance Record
    const printButton = page.getByRole('button', { name: /print|preview|certificate/i });
    await expect(printButton).toBeEnabled();
    await printButton.click();

    await page.waitForURL('**/student/clearance/**/print');
    await expect(page.getByRole('heading', { name: /student clearance certificate — prototype \/ mvp/i })).toBeVisible();

    // Verify key student profile details
    await expect(page.getByText('STUD-2026-0001')).toBeVisible();
    await expect(page.getByText(/Pambayang Kolehiyo ng Mauban/i).first()).toBeVisible();

    // Verify prototype disclaimer wording
    await expect(page.getByText(/prototype \/ mvp output for internal testing only/i)).toBeVisible();

    // Emulate print media styling
    await page.emulateMedia({ media: 'print' });

    // Ensure print-only certificate content remains visible
    await expect(page.locator('#printable-clearance-area, .bg-white').first()).toBeVisible();

    // Ensure navigation button toolbar is hidden in print view
    const printToolbar = page.locator('.print\\:hidden');
    await expect(printToolbar).toBeHidden();
  });
});
