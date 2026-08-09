import { chromium } from '@playwright/test';

function requirePair(email: string | undefined, password: string | undefined, role: string) {
  if (!email || !password) {
    throw new Error(`Set VERCEL_DEMO_${role}_EMAIL and VERCEL_DEMO_${role}_PASSWORD for authenticated smoke checks.`);
  }
}

async function login(
  page: import('@playwright/test').Page,
  baseUrl: string,
  email: string,
  password: string,
  route: string,
) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(`**/${route}`, { timeout: 30_000 });
}

async function main() {
  const baseUrl = process.env.VERCEL_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    console.error('Set VERCEL_BASE_URL to the verified Vercel hostname.');
    process.exitCode = 1;
    return;
  }

  const studentEmail = process.env.VERCEL_DEMO_STUDENT_EMAIL;
  const studentPassword = process.env.VERCEL_DEMO_STUDENT_PASSWORD;
  const adminEmail = process.env.VERCEL_DEMO_ADMIN_EMAIL;
  const adminPassword = process.env.VERCEL_DEMO_ADMIN_PASSWORD;

  const responseRoot = await fetch(`${baseUrl}/`);
  const responseLogin = await fetch(`${baseUrl}/login`);
  if (!responseRoot.ok || !responseLogin.ok) {
    throw new Error(`Public page check failed: /=${responseRoot.status}, /login=${responseLogin.status}`);
  }

  requirePair(studentEmail, studentPassword, 'STUDENT');
  requirePair(adminEmail, adminPassword, 'ADMIN');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const localRequests: string[] = [];
  page.on('request', (request) => {
    if (/127\.0\.0\.1:(8080|9099)/.test(request.url())) localRequests.push(request.url());
  });

  try {
    await login(page, baseUrl, studentEmail!, studentPassword!, 'student/dashboard');
    await page.getByRole('heading', { name: /welcome back/i }).waitFor();
    const banner = page.getByText(/demo environment.*fictional data/i);
    await banner.waitFor({ state: 'visible' });
    const logout = page.getByRole('button', { name: /log out/i });
    await logout.click();
    await page.waitForURL('**/login');

    await login(page, baseUrl, adminEmail!, adminPassword!, 'admin/dashboard');
    await page.getByRole('heading', { name: /system administrator/i }).waitFor();
    await page.goto(`${baseUrl}/admin/reports`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /institution clearance.*reports/i }).waitFor();
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL('**/login');

    if (localRequests.length > 0) {
      throw new Error(`Deployed browser attempted emulator requests: ${localRequests.join(', ')}`);
    }
    console.log(`Vercel smoke test passed for ${baseUrl}: public pages, Student login/dashboard/logout, Admin reports/logout, demo banner, and no emulator requests.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
