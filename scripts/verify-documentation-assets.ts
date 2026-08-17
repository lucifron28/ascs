import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const screenshotDir = resolve(root, 'docs/screenshots');
const svgDir = resolve(root, 'docs/diagrams/svg');
const pngDir = resolve(root, 'docs/diagrams/png');

const screenshots = [
  '01-login.png',
  '02-student-dashboard-approved.png',
  '03-student-dashboard-pending.png',
  '04-student-submit-clearance.png',
  '05-signatory-dashboard.png',
  '06-signatory-review-dialog.png',
  '07-accountant-dashboard.png',
  '08-accountant-financial-dialog.png',
  '09-dean-clearance-queue.png',
  '10-dean-review-dialog.png',
  '11-admin-dashboard-overview.png',
  '12-admin-user-management.png',
  '13-admin-reports.png',
  '14-dean-reports.png',
  '15-printable-clearance-prototype.png',
  '16-not-approved-student-view.png',
];

const fullPageScreenshots = new Set([
  '15-printable-clearance-prototype.png',
  '16-not-approved-student-view.png',
]);

const diagrams = [
  '01-system-context',
  '02-container-architecture',
  '03-vercel-firebase-deployment',
  '04-role-rbac',
  '05-clearance-workflow',
  '06-auth-session-sequence',
  '07-firestore-data-model',
  '08-reporting-data-flow',
];

function pngSize(path: string) {
  const bytes = readFileSync(path);
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`not a PNG: ${path}`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const failures: string[] = [];
for (const file of screenshots) {
  const path = join(screenshotDir, file);
  if (!existsSync(path)) {
    failures.push(`missing screenshot ${file}`);
    continue;
  }
  try {
    const size = pngSize(path);
    if (size.width < 1200 || size.width !== 1440) failures.push(`${file} width is ${size.width}; expected 1440`);
    if (fullPageScreenshots.has(file)) {
      if (size.height < 900) failures.push(`${file} height is ${size.height}; expected a full-page capture at least 900px tall`);
    } else if (size.height !== 900) {
      failures.push(`${file} height is ${size.height}; expected exactly 900`);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

for (const name of diagrams) {
  if (!existsSync(join(svgDir, `${name}.svg`))) failures.push(`missing diagram SVG ${name}.svg`);
  if (!existsSync(join(pngDir, `${name}.png`))) failures.push(`missing diagram PNG ${name}.png`);
}

const visualReference = resolve(root, 'docs/CODEX_VISUAL_REFERENCE.md');
const screenshotIndex = resolve(root, 'docs/SCREENSHOT_INDEX.md');
for (const document of [visualReference, screenshotIndex]) {
  if (!existsSync(document)) {
    failures.push(`missing screenshot document ${document}`);
    continue;
  }
  const text = readFileSync(document, 'utf8');
  for (const file of screenshots) {
    if (!text.includes(file)) failures.push(`${document} does not reference ${file}`);
  }
}

if (failures.length > 0) {
  console.error('Documentation asset verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation assets verified: ${screenshots.length} desktop screenshots and ${diagrams.length} diagram pairs.`);
