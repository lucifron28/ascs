export interface IntegrationScenario {
  scenario: string;
  file: string;
}

export const INTEGRATION_SCENARIOS: IntegrationScenario[] = [
  { scenario: 'accountLifecycle', file: 'tests/integration/account-lifecycle.test.ts' },
  { scenario: 'mandatoryPassword', file: 'tests/integration/password-change.test.ts' },
  { scenario: 'studentSubmission', file: 'tests/integration/clearance-submission.test.ts' },
  { scenario: 'signatoryWorkflow', file: 'tests/integration/signatory-workflow.test.ts' },
  { scenario: 'financialGate', file: 'tests/integration/financial-workflow.test.ts' },
  { scenario: 'deanVisibility', file: 'tests/integration/dean-visibility.test.ts' },
  { scenario: 'clearanceCompletion', file: 'tests/integration/clearance-completion.test.ts' },
  { scenario: 'reports', file: 'tests/integration/reports.test.ts' },
  { scenario: 'sequentialRepairs', file: 'tests/integration/sequential-repairs.test.ts' },
];

export const RULES_TEST_FILE = 'tests/rules/security-boundaries.test.ts';

export function getAllIntegrationTestFiles(): string[] {
  return [...INTEGRATION_SCENARIOS.map((s) => s.file), RULES_TEST_FILE];
}
