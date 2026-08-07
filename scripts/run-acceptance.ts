import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { INTEGRATION_SCENARIOS, RULES_TEST_FILE } from './acceptance-manifest';

interface ScenarioStatus {
  [scenario: string]: string;
}

interface AcceptanceSummary {
  timestamp: string;
  unit: string;
  integration: string;
  e2e: string;
  lint: string;
  build: string;
  scenarios: ScenarioStatus;
}

function run(command: string, label: string, cwd = process.cwd()): boolean {
  process.stdout.write(`\n▶ ${label}\n`);
  const result = spawnSync(command, {
    cwd,
    stdio: 'inherit',
    shell: true,
    timeout: 900_000,
  });
  const ok = result.status === 0;
  process.stdout.write(`${ok ? '✔' : '✘'} ${label} ${ok ? 'PASSED' : 'FAILED'}\n`);
  return ok;
}

function runScenario(scenario: string, file: string): boolean {
  return run(
    `npx firebase emulators:exec --only auth,firestore "npx tsx -r ./tests/helpers/mock-server-only.cjs --test --test-concurrency=1 ${file}"`,
    `Scenario: ${scenario}`
  );
}

export async function runAcceptance(): Promise<AcceptanceSummary> {
  const results: AcceptanceSummary = {
    timestamp: new Date().toISOString(),
    unit: 'pending',
    integration: 'pending',
    e2e: 'pending',
    lint: 'pending',
    build: 'pending',
    scenarios: {},
  };

  results.unit = run('npm test', 'Unit tests') ? 'passed' : 'failed';
  results.lint = run('npm run lint', 'Lint') ? 'passed' : 'failed';
  results.build = run('npm run build', 'Build') ? 'passed' : 'failed';

  const integrationResults: boolean[] = [];

  for (const item of INTEGRATION_SCENARIOS) {
    const ok = runScenario(item.scenario, item.file);
    results.scenarios[item.scenario] = ok ? 'passed' : 'failed';
    integrationResults.push(ok);
  }

  const rulesOk = run(
    `npx firebase emulators:exec --only auth,firestore "npx tsx -r ./tests/helpers/mock-server-only.cjs --test --test-concurrency=1 ${RULES_TEST_FILE}"`,
    'Firestore Rules tests'
  );
  results.scenarios.firestoreRules = rulesOk ? 'passed' : 'failed';
  integrationResults.push(rulesOk);

  results.integration = integrationResults.every(Boolean) ? 'passed' : 'failed';

  results.e2e = run(
    'npx firebase emulators:exec --only auth,firestore "npx playwright test"',
    'Playwright browser acceptance'
  ) ? 'passed' : 'failed';

  // Persist machine-readable artifact
  const artifactsDir = path.resolve(process.cwd(), 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactsDir, 'acceptance-summary.json'),
    JSON.stringify(results, null, 2)
  );

  // Human-readable terminal summary
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ASCS ACCEPTANCE SUMMARY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Timestamp     : ${results.timestamp}`);
  console.log(`  Unit tests    : ${results.unit}`);
  console.log(`  Integration   : ${results.integration}`);
  console.log(`  E2E (browser) : ${results.e2e}`);
  console.log(`  Lint          : ${results.lint}`);
  console.log(`  Build         : ${results.build}`);
  console.log('  ────────────────────────────────────────────────');
  for (const [scenario, status] of Object.entries(results.scenarios)) {
    console.log(`  ${scenario.padEnd(20)}: ${status}`);
  }
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Artifact: artifacts/acceptance-summary.json`);

  return results;
}

if (require.main === module) {
  runAcceptance()
    .then((results) => {
      const allPassed =
        results.unit === 'passed' &&
        results.integration === 'passed' &&
        results.e2e === 'passed' &&
        results.lint === 'passed' &&
        results.build === 'passed' &&
        Object.values(results.scenarios).every((s) => s === 'passed');
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Acceptance run failed:', err);
      process.exit(1);
    });
}
