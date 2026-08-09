# ASCS Acceptance Testing

This document describes the three-layer acceptance strategy for the Automated
Student Clearance System (ASCS), the emulator-only safety model, the
deterministic fixture dataset, commands, and the distinction between unit,
integration, Firestore Rules, and browser tests.

---

## Test architecture

| Layer | Scope | Runner | Requires emulators |
| --- | --- | --- | --- |
| **Unit** | Pure logic and security helpers (status derivation, lifecycle validation, session edge helpers, password transition recovery, report metrics/filters/CSV/authorization, manifest verification, test-session override guard) | `node:test` via tsx | No |
| **Emulator integration** | Real persisted state against Auth + Firestore emulators via server actions / service functions; authorization, transactions, workflow transitions | `node:test` via tsx | Yes |
| **Firestore Rules** | Authenticated **client SDK** operations against the emulator to prove Rules enforce boundaries (Admin SDK bypasses Rules, so these are separate) | `node:test` via tsx + `@firebase/rules-unit-testing` | Yes |
| **Browser acceptance** | High-value user journeys in Chromium (login, mandatory password change, live 9-step multi-role clearance journey, status views, reports) | Playwright | Yes (+ Next.js web server) |

The existing `npm test` unit suite is preserved unchanged. Acceptance layers
are additive.

## Emulator-only safety

Every seed/reset/verification script calls `assertEmulatorEnvironment()`
(`scripts/emulator-safety.ts`), which **refuses to run** unless:

- `FIRESTORE_EMULATOR_HOST` is set
- `FIREBASE_AUTH_EMULATOR_HOST` is set
- `NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'`
- The resolved project ID is not a known production project ID

The reset strategy (`scripts/reset-emulator.ts`) clears the Auth emulator
(`DELETE /emulator/v1/projects/{project}/accounts`) and the Firestore emulator
(`DELETE /emulator/v1/projects/{project}/databases/(default)/documents`), then
re-seeds. Because both environment guards run first, the scripts are
**incapable of deleting or overwriting production data**.

Seeding is **CLI-managed only**. The login page and admin dashboard no longer
mutate the dataset (removed auto-seed bootstrap): a login must never reset a
password or revert a workflow state. Determinism comes from
`npm run demo:reset`.

## Fixture scenarios

Fixtures live in `tests/fixtures/demo-data.ts` (fictional `@example.test`
accounts; no real student or institutional data). Seeded state:

- 8 staff accounts: Admin, Dean, Librarian, Accountant, OSA Coordinator,
  Guidance Counselor, Area Chair, Adviser
- 7 students A–G:
  - **A** — all 5 signatory approvals approved, `paid`, `approved`,
    `printableAvailable = true`
  - **B** — 2 approved / 3 pending, `paid`, `pending`
  - **C** — librarian `not_approved` with remarks, `paid`, `not_approved`
  - **D** — all signatories approved but `unpaid`, `not_approved`
  - **E** — `mustChangePassword = true` (Auth claim + Firestore flag)
  - **F** — `inactive`, `isActive = false`, Auth user disabled
  - **G** — `mustChangePassword = false`, active student for live E2E submission
- 5 clearance requirements (Librarian, OSA Coordinator, Guidance Counselor,
  Area Chair, Adviser) with deterministic IDs and assigned signatories; no
  Accountant approval row
- 4 clearance applications with approvals, remarks, notifications, and
  activity logs for the seeded term (2026-2027, 1st Semester)

`scripts/verify-seed-invariants.ts` asserts every invariant above (including
Student E's Auth custom claims) and fails the seed command if any check
fails — a success message is only printed when the dataset is actually valid.

## Commands

```bash
# Existing unit tests (unchanged)
npm test

# Emulator lifecycle
npm run emulators              # firebase emulators:start --only auth,firestore
npm run emulators:exec         # firebase emulators:exec --only auth,firestore

# Deterministic dataset
npm run seed:emulator          # seed fixtures + verify invariants
npm run reset:emulator         # clear emulator, seed, verify invariants
npm run demo:reset             # alias of reset:emulator
npm run demo:prepare           # reset + seed + print demo accounts summary

# Acceptance layers
npm run test:integration       # emulator integration + Rules tests
npm run test:rules             # Firestore Rules tests only
npm run test:e2e               # Playwright (Chromium)
npm run test:acceptance        # unit + lint + build + integration + rules + e2e
                               # writes artifacts/acceptance-summary.json
```

`test:integration` and `test:e2e` self-orchestrate the emulators through
`firebase emulators:exec` (deterministic lifecycle; no manual start/stop).
Playwright additionally starts the Next.js production server
(`playwright.config.ts` → `webServer`) with emulator environment variables and
runs a global setup (`scripts/prepare-e2e.ts`) that resets and seeds before the suite.

## Expected runtime environment

- Node 20+ (CI pins 20; local 24 verified)
- Java 21+ (required by `firebase-tools ^15.26.0` for Firestore emulator execution)
- Ports 9099 (Auth), 8080 (Firestore), 3000 (Next.js) free
- Chrome/Chromium installed for Playwright (`npx playwright install chromium`)

## Test categories

### Emulator integration (`tests/integration/`)

- `account-lifecycle.test.ts` — admin account creation (student + staff),
  Auth/Firestore synchronization, duplicate rejection, temporary-password
  flag, deactivate/reactivate, final-admin protection, final-admin demotion rejection,
  student-to-staff and staff-to-student role conversion rejection via `updateUserRoleAction()`,
  password reset, inactive-user blocking
- `password-change.test.ts` — full temporary-password workflow: authenticate,
  session reachable for change, normal actions rejected while
  `mustChangePassword`, wrong current password fails, correct change succeeds,
  flag cleared, old session/password invalid, new password works
- `clearance-submission.test.ts` — one application per term, duplicate
  rejection, denormalized fields, initial `pending` financial state, 5
  approval rows without Accountant, notifications, activity log, cross-student
  action rejection
- `signatory-workflow.test.ts` — role queue visibility, cross-role rejection,
  approved/pending/not_approved transitions, remarks requirement and history,
  activity log, student notification, status recalculation
- `financial-workflow.test.ts` — Accountant-only gate, valid/invalid values,
  unpaid-requires-remarks, paid/unpaid status derivation, activity log,
  notification, no Accountant approval row
- `dean-visibility.test.ts` — hidden before Adviser approval, visible after,
  revocation on revert, Dean not a signatory, Dean cannot run Admin actions,
  Dean report scope + no financial summary
- `clearance-completion.test.ts` — approved+paid → printable; approved+unpaid →
  not printable; pending → not printable; not_approved → not printable;
  certificate action refuses when not printable
- `reports.test.ts` — fixture-matched totals, completion denominator,
  paid/unpaid/pending counts, program/year/section breakdowns, bottlenecks,
  Dean scope, role rejection, malformed scope, CSV exports + audit log

### Firestore Rules (`tests/rules/security-boundaries.test.ts`)

Authenticated client-SDK tests against the emulator:

- Student reads own profile/application; **cannot** read another student's
  private data
- Student **cannot** write user/student/application/approval records or financialStatus
- Staff client SDK writes (Librarian, Accountant, Dean, Admin) are denied (Server-Only architecture)
- Unauthenticated access denied

### Browser acceptance (`tests/e2e/`)

- `live-clearance-journey.spec.ts` — full 9-step multi-role browser clearance journey
  (Student G submission → 5 signatories -> Accountant -> Adviser -> Dean oversight -> Student approved status & print control enabled)
- `password-change.spec.ts` — mandatory password journey (login → forced
  change → direct dashboard nav rejected → wrong password error → change →
  re-login with new password → dashboard)
- `clearance-flow.spec.ts` — Student A approved + printable action; Student B
  pending + print unavailable
- `negative-workflow.spec.ts` — Student C not-approved with visible remarks;
  Student D unpaid hold blocks printability
- `reports.spec.ts` — Admin report with financial summary; Dean report
  without financial summary

Selectors prefer `getByRole` / `getByLabel` / `getByText`; labels were added
to login and change-password forms for stable accessible queries.

## Traceability

| Workflow | Unit | Emulator Integration | Rules | Browser |
| --- | --- | --- | --- | --- |
| Account lifecycle | Yes | Yes | Where applicable | Critical smoke |
| Mandatory password | Yes | Yes | N/A | Yes |
| Submission | Status helpers | Yes | Yes | Full Workflow |
| Signatory | Helpers | Yes | Yes | Full Workflow |
| Financial gate | Status helpers | Yes | Yes | Full Workflow |
| Dean visibility | Metrics/report tests | Yes | Yes | Full Workflow |
| Clearance completion | Status helpers | Yes | Yes | Full Workflow |
| Reports | Yes | Yes | Authorization | Yes |
| CSV | Yes | Yes | N/A | Smoke |

## Acceptance result output

`npm run test:acceptance` generates `artifacts/acceptance-summary.json`
(machine-readable, gitignored) and prints a terminal summary. The file is
written only from actual execution results:

```json
{
  "timestamp": "...",
  "unit": "passed",
  "integration": "passed",
  "e2e": "passed",
  "lint": "passed",
  "build": "passed",
  "scenarios": {
    "accountLifecycle": "passed",
    "mandatoryPassword": "passed",
    "studentSubmission": "passed",
    "signatoryWorkflow": "passed",
    "financialGate": "passed",
    "deanVisibility": "passed",
    "clearanceCompletion": "passed",
    "reports": "passed",
    "firestoreRules": "passed"
  }
}
```

## Known unautomated scenarios

- Email notifications (deferred product feature) — not tested.
- Electronic signatures and official certificate issuance (deferred) — the
  print view is a prototype record and asserts no official claim.

## Browser requirements

- Playwright `@playwright/test` with the Chromium project only.
- Install with `npx playwright install chromium`.
- Playwright never points at a production or externally hosted Firebase
  project; the config hard-codes emulator hosts and the `ascs11` demo project.

## Cleanup / reset behavior

- `npm run demo:reset` clears Auth + Firestore emulator data and re-seeds —
  this is the only supported reset path (no manual Emulator UI deletion).
- Every integration/e2e run starts from `resetEmulator()`, so suites are
  repeatable, deterministic, isolated, and safe to rerun.
- Test artifacts (`test-results/`, `playwright-report/`,
  `artifacts/acceptance-summary.json`) are gitignored.

## Distinction summary

- **Unit tests** never touch Firebase; they verify pure logic (status
  derivation, CSV generation, filter validation, session edge helpers, manifest verification, override guards).
- **Integration tests** use the Admin SDK + server actions against the
  emulators and assert persisted state — they prove business logic, not Rules.
- **Rules tests** use the Firebase **client** SDK with authenticated emulator
  users — they prove the security boundary as seen by the browser.
- **Browser tests** prove the end-to-end UX with the real Next.js server and
  emulators; they include a complete 9-step multi-role live journey.
