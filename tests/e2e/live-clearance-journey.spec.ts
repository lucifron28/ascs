import { test, expect } from '@playwright/test';

test.describe('Live Multi-Role Clearance Journey', () => {
  test.setTimeout(120000);

  test('Complete Dean clearance workflow (Student G -> Librarian -> Accountant -> OSA -> Guidance -> Area Chair -> Dean -> Approved Student)', async ({ page }) => {
    // Automatically accept native window.confirm dialogs used in Signatory and Accountant dashboards
    page.on('dialog', (dialog) => dialog.accept());

    // Step 1: Student G submits a new clearance application for 2026-2027 1st Semester
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('student.g@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/student/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    // Select Academic Year 2026-2027, 1st Semester, Graduation
    await page.getByLabel(/academic year/i).selectOption('2026-2027');
    await page.getByLabel(/semester/i).selectOption('1st Semester');
    await page.getByLabel(/purpose/i).selectOption('Graduation');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /submit application/i }).click();

    // Confirm application appears with pending status
    await expect(page.getByText(/pending/i).first()).toBeVisible();
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    // Step 2: Librarian approves Librarian requirement
    await page.getByLabel(/email address/i).fill('librarian@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/librarian/dashboard');
    await expect(page.getByRole('heading', { name: /pending evaluation queue/i })).toBeVisible();

    const libRow = page.locator('tr', { hasText: 'STUD-2026-0007' });
    await expect(libRow).toBeVisible();
    await libRow.getByRole('button', { name: /review/i }).click();

    await page.getByRole('button', { name: /approve clearance/i }).click();
    await expect(page.getByText(/evaluation updated successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /evaluate clearance/i })).toBeHidden({ timeout: 10000 });

    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    // Step 3: Accountant verifies financial status as Paid (after Librarian)
    await page.getByLabel(/email address/i).fill('accountant@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/accountant/dashboard');
    await expect(page.getByRole('heading', { name: /accountant clearance/i })).toBeVisible();

    const accRow = page.locator('tr', { hasText: 'STUD-2026-0007' });
    await expect(accRow).toBeVisible();
    await accRow.getByRole('button', { name: /update/i }).click();

    await page.getByLabel(/mark financially paid/i).check();
    await page.getByRole('button', { name: /save financial status/i }).click();
    await expect(page.getByText(/account status updated successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /update financial account/i })).toBeHidden({ timeout: 10000 });

    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    // Step 4: OSA Coordinator approves OSA requirement
    await page.getByLabel(/email address/i).fill('osa@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/osa_coordinator/dashboard');
    const osaRow = page.locator('tr', { hasText: 'STUD-2026-0007' });
    await expect(osaRow).toBeVisible();
    await osaRow.getByRole('button', { name: /review/i }).click();

    await page.getByRole('button', { name: /approve clearance/i }).click();
    await expect(page.getByText(/evaluation updated successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /evaluate clearance/i })).toBeHidden({ timeout: 10000 });

    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    // Step 5: Guidance Counselor approves Guidance requirement
    await page.getByLabel(/email address/i).fill('guidance@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/guidance_counselor/dashboard');
    const guiRow = page.locator('tr', { hasText: 'STUD-2026-0007' });
    await expect(guiRow).toBeVisible();
    await guiRow.getByRole('button', { name: /review/i }).click();

    await page.getByRole('button', { name: /approve clearance/i }).click();
    await expect(page.getByText(/evaluation updated successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /evaluate clearance/i })).toBeHidden({ timeout: 10000 });

    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    // Step 6: Area Chair approves Area Chair requirement
    await page.getByLabel(/email address/i).fill('chair@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/area_chair/dashboard');
    const chairRow = page.locator('tr', { hasText: 'STUD-2026-0007' });
    await expect(chairRow).toBeVisible();
    await chairRow.getByRole('button', { name: /review/i }).click();

    await page.getByRole('button', { name: /approve clearance/i }).click();
    await expect(page.getByText(/evaluation updated successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /evaluate clearance/i })).toBeHidden({ timeout: 10000 });

    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    // Step 7: Dean of Business Program approves Dean Clearance
    await page.getByLabel(/email address/i).fill('dean@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/dean/dashboard');
    await expect(page.getByRole('heading', { name: /dean clearance queue/i })).toBeVisible();

    const deanRow = page.locator('tr', { hasText: 'STUD-2026-0007' });
    await expect(deanRow).toBeVisible();

    await deanRow.getByRole('button', { name: /review/i }).click();
    await page.getByRole('button', { name: /approve clearance/i }).click();
    await expect(page.getByText(/evaluation updated successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /evaluate clearance/i })).toBeHidden({ timeout: 10000 });

    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    // Step 8: Student G verifies overall approved status & printable clearance control enabled
    await page.getByLabel(/email address/i).fill('student.g@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/student/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    await expect(page.getByText(/approved/i).first()).toBeVisible();
    await expect(page.getByText(/paid /i).first()).toBeVisible();
    await expect(page.getByTestId('workflow-progress')).toHaveText(/6 of 6 stages completed/i);
    await expect(page.getByRole('button', { name: /print|preview|certificate/i })).toBeEnabled();

    // Step 9: Admin verifies Student G in institution reports for 2026-2027 1st Semester
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/admin/dashboard');
    await page.getByRole('link', { name: /reports/i }).click();
    await page.waitForURL('**/admin/reports');
    await expect(page.getByRole('heading', { name: /institution clearance/i })).toBeVisible();

    const adminTotalCard = page.locator('.card', { hasText: 'Total Applications' });
    await expect(adminTotalCard.getByText('5')).toBeVisible();

    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login');

    // Step 10: Dean verifies Student G in Dean clearance reports for 2026-2027 1st Semester
    await page.getByLabel(/email address/i).fill('dean@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/dean/dashboard');
    await page.getByRole('link', { name: /reports/i }).click();
    await page.waitForURL('**/dean/reports');
    await expect(page.getByRole('heading', { name: /academic clearance reports/i })).toBeVisible();

    const deanTotalCard = page.locator('.card', { hasText: 'Total Applications' });
    await expect(deanTotalCard.getByText('3')).toBeVisible();
  });
});
