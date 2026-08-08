# ASCS Project Context

**Project:** Automated Student Clearance System (ASCS)
**Institution:** Pambayang Kolehiyo ng Mauban (PKM)
**Purpose:** Active architecture and business context for the prototype/MVP.

## Architecture

- Next.js App Router with TypeScript, Tailwind CSS, daisyUI, TanStack Form, and Firebase SDKs.
- Firebase Authentication provides email/password identity.
- **Cloud Firestore is the primary database.** Active collections:
  * `users/{userId}`
  * `publicUsers/{userId}`
  * `students/{studentId}`
  * `clearanceRequirements/{requirementId}`
  * `clearanceApplications/{applicationId}`
  * `clearanceApplications/{applicationId}/approvals/{approvalId}`
  * `clearanceApplications/{applicationId}/remarks/{remarkId}`
  * `notifications/{notificationId}`
  * `activityLogs/{logId}`
- Clearance-level financial fields live directly on `clearanceApplications`:
  * `financialStatus: 'pending' | 'paid' | 'unpaid'`
  * `financialVerifiedAt`
  * `financialRemarks`
  * `financialUpdatedBy`
  * `financialUpdatedByName`
- **Trusted Architecture**:
  * Firebase Admin SDK server actions are the trusted write layer.
  * Firestore Security Rules protect direct client access (denying direct client writes).
  * Proxy or client route checks are for navigation/UX only and are not the primary authorization mechanism. Server actions and API routes re-verify the session cookie and user profile.

## Roles and responsibilities

| Role | Responsibility |
| --- | --- |
| Student | Submit and track a clearance application; view remarks and financial status |
| Librarian | Review library clearance approval |
| Accountant | Financial gate only: verify financial status (`paid` vs `unpaid`) |
| OSA Coordinator | Review Office of Student Affairs clearance |
| Guidance Counselor | Review guidance clearance |
| Area Chair | Review area/department clearance |
| Adviser | Review adviser clearance and unlock Dean visibility after approval |
| Dean | View adviser-approved applications for academic review and academic clearance reports |
| Admin | Manage profiles, roles, requirement assignments, activity logs, and institution clearance reports |
## Workflow and status rules

1. A student submits one application for an academic year/semester using canonical semester representation ('1st Semester', '2nd Semester', 'Summer Semester'). Legacy records using short-form semester values ('1st', '2nd', 'Summer') are preserved and supported via storage aliases.
2. The server creates the application, approval rows (5 default required signatories: Librarian, OSA Coordinator, Guidance Counselor, Area Chair, Adviser), student submission confirmation notification, signatory action notifications for assigned or role-wide signatories, and activity log in a Firestore transaction.
3. The Accountant acts as a financial gate only via `financialStatus: 'pending' | 'paid' | 'unpaid'`. The Accountant does not have a duplicate signatory approval row.
4. Signatories act on their own role queue. An assigned approval can only be acted on by its assigned user; an unassigned row is a role-wide queue item.
5. Remarks are required for `pending` and `not_approved` decisions and are visible to the student.
6. A new application starts with `financialStatus = 'pending'`.
   - `paid` means the Accountant verified that the student is financially cleared.
   - `unpaid` means the Accountant verified unresolved financial accountability.
   - `unpaid` blocks overall approval (derives `not_approved`).
7. Status is derived by `lib/clearance/status.ts` (`getClearanceStatusSummary`):
   - Legacy `accountant` approval rows are filtered out of signatory status calculation.
   - If any required signatory approval is `not_approved`, overall status is `not_approved`.
   - If all 5 required signatory approvals are `approved` and `financialStatus` is `paid`, overall status is `approved`.
   - If all required signatory approvals are `approved` and `financialStatus` is `unpaid`, overall status is `not_approved`.
   - Otherwise, overall status is `pending`.
8. Printable clearance (`printableAvailable`) is true and available only when overall status is `approved`.
   The print view is a prototype/MVP record and makes no official institutional approval claim.
9. The Dean sees applications only after the Adviser approval is `approved`.

## Data model

- `users/{uid}`: identity, role, account status, and display profile.
- `publicUsers/{uid}`: authenticated read-only display profile projection.
- `students/{uid}`: student number and academic profile.
- `clearanceRequirements/{requirementId}`: active role/label/order and optional
  signatory assignment.
- `clearanceApplications/{applicationId}`: student snapshot, term/purpose,
  status counters, financial fields, and adviser/print flags.
- `clearanceApplications/{id}/approvals/{approvalId}`: role, assignment,
  status, latest remark, actor, and timestamps.
- `clearanceApplications/{id}/remarks/{remarkId}`: immutable remark history.
- `notifications/{notificationId}`: recipient-scoped in-app notifications.
- `activityLogs/{logId}`: server-written audit events.

## Security boundary

Firestore client writes for workflow, profile creation, role changes, account
status, requirements, notifications, remarks, approvals, and audit logs are
denied by Rules. Admin SDK operations are trusted only after server-side
session/profile/role checks. Only the Firestore collections and subcollections
listed above are part of the active ASCS system.

## Prototype scope and known limits

The MVP demonstrates the core student, signatory, accountant, dean, and admin
flows with in-app notifications, administrator account lifecycle management, and a print-friendly HTML record.
System administrators can create student and staff accounts, deactivate and reactivate accounts,
issue temporary passwords, change system roles, assign requirement signatories, and inspect activity logs.
Newly created and reset accounts must complete a mandatory password change at `/change-password` before
accessing normal dashboards.
System Administrators and the Academic Dean have access to role-scoped clearance reports and CSV exports:
- `/admin/reports`: Institution-wide clearance metrics, financial summaries (Paid / Unpaid / Pending), requirement bottlenecks (`Highest Unresolved Requirements`), program/year-level/section breakdowns, and safe CSV data exports.
- `/dean/reports`: Academic clearance progress for adviser-approved applications (`adviserApproved === true`), program breakdowns, requirement bottlenecks, and role-scoped Dean CSV exports. Financial summaries are excluded from Dean scope.
- **Reporting Architecture & Scaling Guards**:
  * Submitted clearance applications within scope serve as the denominator for completion rates.
  * Dataset Limit Guard: Report queries are bounded to `MAX_REPORT_APPLICATIONS = 5000`. Requests exceeding 5,000 documents throw an explicit error requiring filter narrowing.
  * Approval Aggregation: Requirement metrics read subcollections in controlled parallel batches (`APPROVAL_BATCH_SIZE = 25`) to ensure complete requirement metrics across 500+ applications.
  * CSV Privacy & Safety: Cells beginning with `=`, `+`, `-`, or `@` are prepended with `'` to prevent formula injection. Exports write activity log entries.
Email notifications, electronic signatures, and production certificate issuance remain deferred.

## Acceptance testing evidence

A repeatable acceptance environment proves the main ASCS workflows against the Firebase
Emulator Suite with a deterministic fictional dataset (`tests/fixtures/demo-data.ts`):

- **Emulator seeding is CLI-managed and production-safe**: `npm run demo:reset` clears and
  reseeds the Auth + Firestore emulators through `scripts/reset-emulator.ts` /
  `scripts/seed-emulator.ts`; every seed/reset path first passes `assertEmulatorEnvironment()`
  (`scripts/emulator-safety.ts`), which refuses to run without
  `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `NEXT_PUBLIC_USE_FIREBASE_EMULATOR`,
  and rejects known production project IDs. `scripts/verify-seed-invariants.ts` fails the seed
  when any invariant (roles, profiles, student records, clearance requirements, Student A–F
  lifecycle states, report variety) does not hold.
- **Integration tests** (`tests/integration/`) execute real server actions and service
  functions against the emulators and assert persisted state: account lifecycle, mandatory
  password change, clearance submission, signatory workflow, accountant financial gate,
  Adviser→Dean visibility, final approval/printability, reports, and CSV export audit logs.
- **Firestore Rules tests** (`tests/rules/security-boundaries.test.ts`) use the Firebase client
  SDK with authenticated emulator users to prove Rules boundaries (Admin SDK bypasses Rules,
  so these are separate): own-record reads allowed, cross-student reads denied, all
  privileged writes denied for every role.
- **Browser acceptance** (`tests/e2e/`, Playwright + Chromium) covers the mandatory password
  journey, approved/pending/not-approved/unpaid student dashboards, and Admin/Dean reports
  (including the Dean financial-privacy boundary).
- `npm run test:acceptance` runs unit + lint + build + integration + Rules + browser layers
  and writes `artifacts/acceptance-summary.json` from actual results.

See `docs/ACCEPTANCE_TESTING.md` for the full test architecture and traceability matrix, and
`docs/DEMO_SCENARIO.md` for the live defense/demo walkthrough.
