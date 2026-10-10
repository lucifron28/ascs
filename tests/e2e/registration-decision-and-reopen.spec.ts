import { test, expect } from '@playwright/test';

test.describe('Registration Decisions & Accountant Reopen E2E', () => {
  test('Accountant Paid / Cleared shows Reopen button and dialog with required reason', async ({ page }) => {
    // 1. Log in as Accountant
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('accountant@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL('**/accountant/dashboard');

    // 2. Select Paid / Cleared filter
    const paidTab = page.getByRole('button', { name: /paid \/ cleared/i });
    await expect(paidTab).toBeVisible();
    await paidTab.click();

    // 3. Paid record displays Settled and Reopen button
    const paidRow = page.locator('tr', { hasText: 'STUD-2026-0001' });
    await expect(paidRow).toBeVisible();
    await expect(paidRow).toContainText('Settled');
    const reopenBtn = paidRow.getByRole('button', { name: /reopen/i });
    await expect(reopenBtn).toBeVisible();

    // 4. Open Reopen modal
    await reopenBtn.click();
    const reopenDialog = page.getByRole('dialog', { name: /reopen financial account/i });
    await expect(reopenDialog).toBeVisible();
    await expect(reopenDialog).toContainText('Workflow Impact Warning');
    await expect(reopenDialog.getByLabel(/reopen reason/i)).toBeVisible();

    // 5. Cancel closes dialog cleanly
    await reopenDialog.getByRole('button', { name: /cancel/i }).click();
    await expect(reopenDialog).not.toBeVisible();
  });

  test('Admin Reject Registration modal requires a rejection reason', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `student.e2e.${timestamp}@example.test`;

    // 1. Student self-registers
    await page.goto('/register');
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByLabel(/student number/i).fill(`STUD-E2E-${timestamp.toString().slice(-4)}`);
    await page.getByLabel(/full name/i).fill('E2E Pending Student');
    await page.getByLabel(/academic program/i).selectOption('BSAIS');
    await page.getByLabel(/year level/i).selectOption('1st Year');
    await page.getByLabel(/semester/i).selectOption('1st Semester');
    await page.getByLabel(/section/i).fill('A');
    await page.getByLabel(/^password/i).fill('TestPassword123!');
    await page.getByLabel(/confirm password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /create student account/i }).click();

    await expect(page.getByText(/registration submitted/i)).toBeVisible();

    // 2. Log in as Admin
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@example.test');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL('**/admin/dashboard');

    // 3. Click Review Registrations button to view pending registrations directly
    await page.getByRole('button', { name: /review registrations/i }).click();

    // 5. Locate newly registered student row and click Reject
    const studentRow = page.locator('tr', { hasText: testEmail });
    await expect(studentRow).toBeVisible();
    await studentRow.getByRole('button', { name: /reject/i }).click();

    // 6. Verify Reject dialog displays mandatory reason input
    const rejectDialog = page.getByRole('dialog', { name: /reject student registration/i });
    await expect(rejectDialog).toBeVisible();
    const reasonTextarea = rejectDialog.getByLabel(/rejection reason/i);
    await expect(reasonTextarea).toBeVisible();

    // 7. Attempt submit without reason -> validation error
    const confirmBtn = rejectDialog.getByRole('button', { name: /confirm rejection/i });
    await confirmBtn.click();
    await expect(rejectDialog.getByText(/rejection reason between 5 and 500 characters is required/i)).toBeVisible();

    // 8. Cancel closes dialog cleanly
    await rejectDialog.getByRole('button', { name: /cancel/i }).click();
    await expect(rejectDialog).not.toBeVisible();
  });
});
