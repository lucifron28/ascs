import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

const SIGNATORY_ACCOUNTS = [
  { name: 'Librarian', email: 'librarian@example.test', path: 'librarian/dashboard' },
  { name: 'OSA Coordinator', email: 'osa@example.test', path: 'osa_coordinator/dashboard' },
  { name: 'Guidance Counselor', email: 'guidance@example.test', path: 'guidance_counselor/dashboard' },
  { name: 'Area Chair', email: 'chair@example.test', path: 'area_chair/dashboard' },
  { name: 'Dean', email: 'dean@example.test', path: 'dean/dashboard' },
] as const;

async function signIn(page: Page, email: string, path: string) {
  await page.goto('/login');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(`**/${path}`);
}

async function expectNoPageOverflow(page: Page, width: number) {
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(width);
}

test.describe('Student academic details on staff dashboards', () => {
  for (const account of SIGNATORY_ACCOUNTS) {
    test(`${account.name} sees and searches year, program, and section on mobile and desktop`, async ({ page }) => {
      await signIn(page, account.email, account.path);
      await expect(page.getByRole('button', { name: /approved history/i })).toBeVisible();
      await page.getByRole('button', { name: /approved history/i }).click();

      const search = page.getByPlaceholder(/search students by name, student #/i);
      await expect(search).toBeVisible();
      await search.fill(' 4TH yr.   BSAIS A ');
      const academicDetails = page.getByText('4th yr. - BSAIS - A', { exact: true });
      await expect(academicDetails).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Student #' })).toBeVisible();

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await expect(academicDetails).toBeVisible();
        await expectNoPageOverflow(page, viewport.width);
      }
    });
  }

  test('Librarian pending queue shows academic details and searches by Student #', async ({ page }) => {
    await signIn(page, 'librarian@example.test', 'librarian/dashboard');

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const academicDetails = page.getByText('1st yr. - BSAIS - A', { exact: true });
      await expect(academicDetails).toBeVisible();
      await page.getByPlaceholder(/search students by name, student #/i).fill('STUD-2026-0005');
      await expect(page.getByRole('row').filter({ hasText: 'Student E (Temp Pass)' })).toBeVisible();
      await expectNoPageOverflow(page, viewport.width);
    }
  });

  test('Accountant sees and searches academic details on mobile and desktop', async ({ page }) => {
    await signIn(page, 'accountant@example.test', 'accountant/dashboard');
    const search = page.getByPlaceholder(/search name, student #/i);
    await search.fill(' 4TH yr BSAIS A ');
    const academicDetails = page.getByText('4th yr. - BSAIS - A', { exact: true });
    await expect(academicDetails).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Student #' })).toBeVisible();

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(academicDetails).toBeVisible();
      await expectNoPageOverflow(page, viewport.width);
    }
  });

  test('Admin has separate year and section columns and can search them', async ({ page }) => {
    await signIn(page, 'admin@example.test', 'admin/dashboard');
    await page.getByRole('button', { name: /^users/i }).click();
    const search = page.getByPlaceholder(/search by name, student #/i);
    await expect(page.getByRole('columnheader', { name: 'Year' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Section' })).toBeVisible();
    await search.fill(' 4th yr BSAIS A ');
    const studentRow = page.getByRole('row').filter({ hasText: 'Student A (Approved)' });
    await expect(studentRow).toBeVisible();
    await expect(studentRow).toContainText('4th Year');
    await expect(studentRow).toContainText('A');

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(studentRow).toBeVisible();
      await expectNoPageOverflow(page, viewport.width);
    }

    await page.goto('/admin/reports');
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(page.locator('#report-filter-yl option[value="2nd Year"]')).toHaveText('2nd Year');
      await expectNoPageOverflow(page, viewport.width);
    }
  });
});
