import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

const baseUrl = (process.env.DOC_SCREENSHOT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const outputDir = resolve(process.cwd(), 'docs/screenshots');
mkdirSync(outputDir, { recursive: true });

const viewport = { width: 1440, height: 900 };

async function setAscsLightTheme(page: Page) {
  const themeButton = page.getByRole('button', { name: /change theme/i });
  await themeButton.click();
  await page.getByRole('menuitem', { name: /ascs light/i }).click();
  await page.waitForTimeout(450);
}

async function login(page: Page, email: string, route: string) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Sign In' }).waitFor();
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(`**/${route}`, { timeout: 30_000 });
  await setAscsLightTheme(page);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /logout/i }).first().click();
  await page.waitForURL('**/login', { timeout: 30_000 });
}

async function capture(page: Page, name: string, fullPage = false) {
  await page.screenshot({
    path: join(outputDir, name),
    fullPage,
    animations: 'disabled',
  });
  console.log(`captured ${name}`);
}

async function replaceContext(browser: Browser, currentContext: BrowserContext) {
  await currentContext.close();
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  return { context, page };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  let page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await setAscsLightTheme(page);
    await page.getByRole('heading', { name: 'Sign In' }).waitFor();
    await capture(page, '01-login.png', false);

    await login(page, 'student.a@example.test', 'student/dashboard');
    await page.getByRole('heading', { name: /welcome back/i }).waitFor();
    await capture(page, '02-student-dashboard-approved.png');
    await logout(page);
    ({ context, page } = await replaceContext(browser, context));

    await login(page, 'student.b@example.test', 'student/dashboard');
    await page.getByRole('heading', { name: /welcome back/i }).waitFor();
    await capture(page, '03-student-dashboard-pending.png');
    await logout(page);
    ({ context, page } = await replaceContext(browser, context));

    await login(page, 'student.g@example.test', 'student/dashboard');
    await page.getByRole('heading', { name: /welcome back/i }).waitFor();
    await page.getByRole('heading', { name: /clearance application/i }).waitFor();
    await capture(page, '04-student-submit-clearance.png');
    await logout(page);
    ({ context, page } = await replaceContext(browser, context));

    await login(page, 'guidance@example.test', 'guidance_counselor/dashboard');
    await page.getByRole('heading', { name: /pending evaluation queue/i }).waitFor();
    await capture(page, '05-signatory-dashboard.png');
    await page.getByRole('button', { name: /review clearance/i }).first().click();
    await page.getByRole('dialog', { name: /evaluate clearance requirement/i }).waitFor();
    await capture(page, '06-signatory-review-dialog.png', false);
    await page.getByRole('dialog').getByRole('button', { name: /close dialog/i }).click();
    await logout(page);
    ({ context, page } = await replaceContext(browser, context));

    await login(page, 'accountant@example.test', 'accountant/dashboard');
    await page.getByRole('heading', { name: /financial accountability management/i }).waitFor();
    await capture(page, '07-accountant-dashboard.png');
    await page.getByRole('button', { name: /update financial status/i }).first().click();
    await page.getByRole('dialog', { name: /update financial account/i }).waitFor();
    await capture(page, '08-accountant-financial-dialog.png', false);
    await page.getByRole('dialog').getByRole('button', { name: /close dialog/i }).click();
    await logout(page);
    ({ context, page } = await replaceContext(browser, context));

    await login(page, 'adviser@example.test', 'adviser/dashboard');
    await page.getByRole('heading', { name: /pending evaluation queue/i }).waitFor();
    await capture(page, '09-adviser-dashboard.png');
    await logout(page);
    ({ context, page } = await replaceContext(browser, context));

    await login(page, 'dean@example.test', 'dean/dashboard');
    await page.getByRole('heading', { name: /dean clearance oversight/i }).waitFor();
    await capture(page, '10-dean-dashboard.png');
    await page.goto(`${baseUrl}/dean/reports`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /academic clearance reports/i }).waitFor();
    await capture(page, '14-dean-reports.png');
    await logout(page);
    ({ context, page } = await replaceContext(browser, context));

    await login(page, 'admin@example.test', 'admin/dashboard');
    await page.getByRole('heading', { name: /admin control center/i }).waitFor();
    await capture(page, '11-admin-dashboard-overview.png');
    await page.getByRole('button', { name: /users \(/i }).click();
    await page.getByText('User Details', { exact: true }).waitFor();
    await capture(page, '12-admin-user-management.png');
    await page.goto(`${baseUrl}/admin/reports`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /institution clearance.*reports/i }).waitFor();
    await capture(page, '13-admin-reports.png');
    await logout(page);
    ({ context, page } = await replaceContext(browser, context));

    await login(page, 'student.a@example.test', 'student/dashboard');
    await page.goto(`${baseUrl}/student/clearance/app-student-a/print`, { waitUntil: 'networkidle' });
    await page.getByTestId('printable-clearance-area').waitFor();
    await capture(page, '15-printable-clearance-prototype.png', true);
    ({ context, page } = await replaceContext(browser, context));

    await login(page, 'student.c@example.test', 'student/dashboard');
    await page.getByRole('heading', { name: /welcome back/i }).waitFor();
    await capture(page, '16-not-approved-student-view.png', true);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
