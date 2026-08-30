# ASCS Technical Architecture

## 1. System overview

The Automated Student Clearance System (ASCS) is a capstone/research MVP for
Pambayang Kolehiyo ng Mauban. It digitizes student clearance routing while
keeping financial accountability as a separate Accountant-controlled gate.
The application is server-first: the browser renders the Next.js App Router UI,
while authenticated Server Actions perform trusted workflow, account, report,
and audit operations.

The current implementation uses the following versions from `package.json`:

| Layer | Technology | Version / role |
| --- | --- | --- |
| Language | TypeScript | `^5` |
| Web framework | Next.js App Router | `16.2.10` |
| UI runtime | React / React DOM | `19.2.4` |
| Styling | Tailwind CSS / daisyUI | `^4` / `^5.6.13` |
| Identity | Firebase Authentication Web SDK | `^12.15.0` |
| Trusted server access | Firebase Admin SDK | `^14.1.0` |
| Database | Cloud Firestore | Firebase project service |
| Forms | TanStack Form | `^1.33.0` |
| Server state | TanStack Query | `^5.101.2` |
| Tests | Node test runner, tsx, Playwright, axe-core | package devDependencies |
| Local verification | Firebase Emulator Suite | Auth `9099`, Firestore `8080` |
| Demonstration hosting | Vercel | external demo environment only |
| Source control / CI | Git, GitHub, GitHub Actions | repository workflow |

ASCS is not an official institutional production system. The deterministic
local environment and any remote Vercel deployment use fictional demonstration
data only; the print view is an MVP prototype record, not an official PKM
certificate or receipt.

## 2. Major architectural boundaries

```text
Browser / React client
        |
        +--> Firebase Web Auth (email/password sign-in)
        |
        v
Next.js App Router UI and Server Actions
        |
        +--> HTTP-only session cookie verification
        +--> role/status authorization
        +--> Firebase Admin SDK
                         |
                         +--> Firebase Authentication
                         +--> Cloud Firestore

Firestore Security Rules protect direct client SDK access.
```

### Client-side responsibilities

- Render role-specific pages and shared `RoleHeader` controls.
- Sign in through the Firebase Web SDK and submit the resulting ID token to the
  session endpoint.
- Manage UI state, form state, dialog state, theme selection, notifications,
  and TanStack Query cache state.
- Read only the public/client-allowed data paths. Direct workflow writes are
  denied by `firestore.rules`.

### Server-side responsibilities

- Verify the HTTP-only session cookie and retrieve the authoritative Firestore
  `users/{uid}` profile in `lib/auth/session.ts`.
- Enforce account status, mandatory password change, role, and scope checks.
- Use `lib/firebase/admin.ts` and Firebase Admin SDK for privileged Auth and
  Firestore operations.
- Execute clearance submissions, signatory decisions, financial updates,
  account lifecycle changes, report queries, CSV generation, notifications, and
  activity-log writes through `app/actions/`.
- Apply Firestore Rules as the direct-client boundary. Rules do not replace
  Server Action authorization; the two boundaries protect different paths.

## 3. Authentication and session architecture

1. A user signs in with Firebase email/password through the browser client.
2. Firebase returns an ID token; the app exchanges it for a server session.
3. The server stores the session in the `ascs_session` HTTP-only cookie (the
   name is configurable through `SESSION_COOKIE_NAME`).
4. Server Actions call `getAuthenticatedUser()` /
   `getAuthenticatedUserForPasswordChange()` to verify the session and load the
   Firestore profile.
5. Authorization checks `role`, `accountStatus`/`isActive`, and
   `mustChangePassword` before the requested operation.
6. Logout clears the session through `/api/auth/logout`. Deactivation and
   password reset also revoke or invalidate active sessions where applicable.

Session cookies are not stored in `localStorage`. Edge-compatible session
verification is covered by `lib/auth/edge-session.test.ts`; password transition
behavior is covered by `lib/auth/password-transition.test.ts` and
`tests/integration/password-change.test.ts`.

## 4. Roles and authorization model

The nine implemented roles are:

| Role | High-level responsibility |
| --- | --- |
| Student | Submit a term clearance, track approvals and remarks, view financial status, and open the prototype print record after approval. |
| Librarian | Review the library requirement queue. |
| OSA Coordinator | Review the Office of Student Affairs requirement queue. |
| Guidance Counselor | Review the guidance requirement queue. |
| Area Chair | Review the program/area requirement queue. |
| Adviser (legacy) | Preserved for historical records only; cannot be newly created or assigned. |
| Accountant | Verify `financialStatus`; this is a financial gate, not a duplicate approval row. |
| Dean of Business Program | Review and approve the sixth Dean Clearance stage (the fifth approval row); access Dean-scoped reports separately. |
| System Administrator | Manage accounts, roles, requirement assignments, activity logs, and institution-wide reports. |

`UserRole` is defined in `lib/types/roles.ts`. Role-specific routing is
implemented by the dashboard pages and `RoleHeader`; server authorization is
implemented in `lib/auth/session.ts`, `app/actions/`, and report authorization
helpers.

## 5. Clearance state model

Each `clearanceApplications/{applicationId}` document stores direct financial
fields and denormalized status counters. The financial state is:

```text
pending | paid | unpaid
```

The approval/overall state is:

```text
approved | pending | not_approved
```

`lib/clearance/status.ts` derives the overall status from the five required
signatory approval rows and `financialStatus`. The canonical workflow exposes
six ordered stages: Librarian (1), Accountant financial gate (2), OSA
Coordinator (3), Guidance Counselor (4), Area Chair (5), and Dean (6):

- Any required `not_approved` row produces `not_approved`.
- All required signatories approved plus `paid` produces `approved`.
- All required signatories approved plus `unpaid` produces `not_approved`.
- Otherwise the result is `pending`.
- Legacy Accountant approval rows are ignored for signatory counts.
- `printableAvailable` is true only for `approved`. The print route renders an
  A4-oriented digital prototype record with six ordered workflow rows and
  explicit Stage / Office, Type, Status, Assigned Signatory, Remarks, and Date
  Reviewed columns. The Accountant row is a financial gate rather than an
  approval signature. No handwritten or electronic signatures are reproduced.

The Dean is the sixth workflow stage and fifth active approval row. A successful
Dean action writes `deanApproved`, recomputes the application counters, and
keeps Dean reports separately scoped. Historical Adviser rows and the optional
`adviserApproved` field remain readable during migration but are not counted.

## 6. Firestore data model

The active collections are:

| Collection | Purpose |
| --- | --- |
| `users/{uid}` | Authoritative profile, role, status, and password-transition flags. |
| `publicUsers/{uid}` | Authenticated read-only display projection. |
| `students/{uid}` | Student number and academic profile. |
| `clearanceRequirements/{requirementId}` | Active requirement definitions, role, ordering, and optional signatory assignment. |
| `clearanceApplications/{applicationId}` | Application snapshot, term, status, financial fields, counters, and flags. |
| `clearanceApplications/{id}/approvals/{approvalId}` | Logical signatory relationship, status, assignment, and latest remark. |
| `clearanceApplications/{id}/remarks/{remarkId}` | Immutable remark history. |
| `notifications/{notificationId}` | Recipient-scoped in-app notifications. |
| `activityLogs/{logId}` | Server-written audit events. |

Important application fields include `studentUid`, `academicYear`, `semester`,
`overallStatus`, `financialStatus`, `deanApproved`, and
`printableAvailable`. These are denormalized references and logical
relationships; Firestore does not enforce relational foreign keys.

The `approvals` collection-group query uses the composite index on
`status ASCENDING` and `signatoryRole ASCENDING`. The server still rechecks
the sequential stage before every approval or financial write.

## 7. Reporting architecture

`app/actions/reports.ts` separates Admin and Dean scopes:

- Admin reports query institution-wide applications and may include financial
  summaries and financial detail columns.
- Dean reports require `deanApproved === true` and intentionally exclude
  the Admin financial summary and financial detail columns.
- `lib/reports/filters.ts` canonicalizes academic year and semester values while
  supporting legacy semester aliases.
- `lib/reports/authorization.ts` validates role, session state, scope, and the
  5,000-application dataset limit.
- `lib/reports/metrics.ts` validates statuses, deduplicates application IDs,
  computes completion and bottleneck metrics, and rejects contradictory data.
- `lib/reports/csv.ts` escapes values and neutralizes spreadsheet formula
  injection (`=`, `+`, `-`, `@`, tabs, and carriage returns).

## 8. Testing architecture

| Layer | Evidence |
| --- | --- |
| Unit | `npm test`; pure status, lifecycle, session, report, CSV, and authorization tests. |
| Emulator integration | `tests/integration/`; real Server Actions and persisted Auth/Firestore state. |
| Firestore Rules | `tests/rules/security-boundaries.test.ts`; client SDK access boundaries. |
| Browser acceptance | `tests/e2e/`; Chromium journeys for password change, clearance states, reports, and live multi-role workflow. |
| UX/accessibility | `tests/e2e/accessibility.spec.ts`, `responsive-layout.spec.ts`, `keyboard-navigation.spec.ts`, and `print-clearance.spec.ts`; axe, responsive, keyboard, dialog, and print checks. |
| Orchestration | `scripts/run-acceptance.ts` and `.github/workflows/acceptance.yml`. |

The deterministic fixture source is `tests/fixtures/demo-data.ts`. Reset and
seed commands are guarded by `scripts/emulator-safety.ts` and must not be used
against a remote project.

## 9. Scope and limitations

This capstone MVP does not claim official deployment, security certification,
WCAG certification, official electronic signatures, official financial
receipts, or official institutional certificate issuance. Email delivery,
electronic signatures, payment gateway integration, profile editing, bulk CSV
account import, and other post-MVP features remain deferred.

## 10. Evidence map

| Architecture topic | Source evidence | Test evidence |
| --- | --- | --- |
| Session and password transition | `lib/auth/session.ts`, `lib/auth/edge-session.ts`, `app/api/auth/` | `lib/auth/*test.ts`, `tests/integration/password-change.test.ts` |
| Clearance workflow | `app/actions/clearance.ts`, `lib/clearance/status.ts` | `tests/integration/clearance-submission.test.ts`, `signatory-workflow.test.ts`, `financial-workflow.test.ts`, `clearance-completion.test.ts` |
| Dean visibility | `app/actions/clearance.ts`, `app/actions/reports.ts`, `components/dean/DeanDashboard.tsx` | `tests/integration/dean-visibility.test.ts`, `tests/e2e/reports.spec.ts` |
| Account lifecycle | `app/actions/admin-accounts.ts`, `components/admin/AdminDashboard.tsx` | `tests/integration/account-lifecycle.test.ts`, `lib/admin/lifecycle.test.ts` |
| Reporting and CSV | `app/actions/reports.ts`, `lib/reports/` | `tests/integration/reports.test.ts`, `lib/reports/*test.ts` |
