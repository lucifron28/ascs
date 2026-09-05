import { test, expect, type APIRequestContext } from '@playwright/test';

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const financialStatusUrl = (applicationId: string) =>
  `http://${firestoreHost}/v1/projects/ascs11/databases/(default)/documents/clearanceApplications/${applicationId}?updateMask.fieldPaths=financialStatus`;

async function setFinancialStatus(request: APIRequestContext, applicationId: string, status: 'pending' | 'paid') {
  const response = await request.patch(financialStatusUrl(applicationId), {
    headers: { Authorization: 'Bearer owner' },
    data: { fields: { financialStatus: { stringValue: status } } },
  });
  expect(response.ok()).toBeTruthy();
}

test.describe('Accountant financial decision state', () => {
  test('requires an explicit decision for Pending and preserves existing decisions', async ({ page, request }) => {
    await setFinancialStatus(request, 'app-student-b', 'pending');

    try {
      await page.goto('/login');
      await page.getByLabel(/email address/i).fill('accountant@example.test');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL('**/accountant/dashboard');

      const pendingRow = page.locator('tr', { hasText: 'STUD-2026-0002' });
      await expect(pendingRow).toContainText('Pending Audit');
      await expect(pendingRow).toContainText('Pending financial review.');
      await expect(pendingRow).not.toContainText('No outstanding balances.');
      await pendingRow.getByRole('button', { name: /update financial status/i }).click();

      const dialog = page.getByRole('dialog', { name: /update financial account/i });
      await expect(dialog).toBeVisible();
      const paid = dialog.getByLabel(/mark financially paid/i);
      const unpaid = dialog.getByLabel(/mark unpaid dues/i);
      const save = dialog.getByRole('button', { name: /save financial status/i });
      await expect(paid).not.toBeChecked();
      await expect(unpaid).not.toBeChecked();
      await expect(save).toBeDisabled();

      await paid.check();
      await expect(save).toBeEnabled();
      await unpaid.check();
      await expect(save).toBeEnabled();
      await dialog.getByRole('button', { name: /close dialog/i }).click();

      await page.getByRole('button', { name: /completed history/i }).click();
      const paidRow = page.locator('tr', { hasText: 'STUD-2026-0001' });
      await expect(paidRow).toContainText('Completed');
      await expect(paidRow.getByRole('button', { name: /update/i })).toHaveCount(0);
      await page.getByRole('button', { name: /back to action queue/i }).click();
      const unpaidRow = page.locator('tr', { hasText: 'STUD-2026-0004' });
      await unpaidRow.getByRole('button', { name: /update financial status/i }).click();
      await expect(page.getByRole('dialog').getByLabel(/mark unpaid dues/i)).toBeChecked();
    } finally {
      await setFinancialStatus(request, 'app-student-b', 'paid');
    }
  });
});
