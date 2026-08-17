# ASCS Manuscript Alignment Guide

This guide maps manuscript statements to the current ASCS implementation. The
source repository and executable tests are authoritative when older manuscript
wording conflicts with this document.

## 1. Final system title

**Automated Student Clearance System with Integrated Financial Accountability
Monitoring for Pambayang Kolehiyo ng Mauban.**

## 2. Problem addressed

ASCS addresses the routing, visibility, and accountability problems of a
paper-based clearance process. The existing PKM clearance-slip hierarchy
informed the digital record's institution header, clearance title, academic
term, identity block, office checklist, remarks, dates, and closing note; the
digital system restructures those fields into readable status data rather than
reproducing handwritten signatures or personal paper details. It provides a
single workflow for student submission, role-scoped signatory decisions, a
  separate Accountant financial gate, Dean signatory approval, notifications,
audit logs, and scoped reports.

Evidence: `app/actions/clearance.ts`, `components/student/`,
`components/signatory/`, `components/accountant/`, `docs/DEMO_SCENARIO.md`.

## 3. System scope

The MVP covers student clearance submission and tracking, five required
signatory requirements, Accountant financial verification, Dean final approval,
Admin account/requirement management, Admin and Dean reports, CSV
exports, in-app notifications, activity logs, and a print-friendly prototype
record. It is a capstone demonstration system using fictional data.

It does not claim official PKM deployment, official certificates, electronic
signatures, financial receipts, payment processing, email delivery, or
production readiness.

## 4. User roles

| Role | Implemented responsibility |
| --- | --- |
| Student | Submit and track clearance; read remarks and financial status; print approved prototype record. |
| Librarian | Library requirement review. |
| OSA Coordinator | OSA requirement review. |
| Guidance Counselor | Guidance requirement review. |
| Area Chair | Academic area requirement review. |
| Adviser (legacy) | Historical compatibility only; excluded from new flow. |
| Accountant | Financial gate (`pending`, `paid`, `unpaid`), not a duplicate approval row. |
| Dean | Dean Clearance approval and Dean reports. |
| System Administrator | Account lifecycle, roles, assignments, logs, and institution reports. |

Evidence: `lib/types/roles.ts`, `tests/fixtures/demo-data.ts`,
`docs/TECHNICAL_ARCHITECTURE.md`.

## 5. Demonstration dataset and academic programs

The demonstration dataset uses the PKM program catalog supplied for the ASCS
project. Firestore keeps the stable **Program Code** on student profiles and
clearance applications; the shared catalog derives the corresponding **Program
Name** for student views, administrative tables, reports, CSV output, and the
printable prototype. The seven deterministic student scenarios use BSAIS,
BSMA, BEED, CRIM, ENGLISH, ACP, and FSM respectively; FILIPINO, MATH, and SS
remain supported catalog entries for future fictional records.

The local emulator login exposes one grouped account selector for all seven
student scenarios and eight staff identities. The selector requires both Demo
Mode and Firebase Emulator Mode and is not rendered on the public Vercel
fictional-data demo. It only fills the normal Firebase login form; it does not
bypass authentication or display a password in selected-account details.

Evidence: `lib/academic-programs.ts`, `lib/demo/demo-accounts.ts`,
`tests/fixtures/demo-data.ts`, `app/login/page.tsx`,
`lib/academic-programs.test.ts`, `lib/demo/demo-accounts.test.ts`.

## 6. Functional requirements

The FRD checklist records 33 implemented requirements and one deferred item:
Bulk CSV Account Import. The implemented requirements include account creation,
deactivation/reactivation, mandatory password change, submission,
duplicate-term prevention, signatory decisions with required remarks,
  Accountant financial updates, Dean approval, notifications,
activity logs, reporting, and CSV exports.

Evidence: `docs/FRD_COMPLIANCE_CHECKLIST.md`, `app/actions/`,
`tests/integration/`, `tests/e2e/`.

## 7. Architecture

ASCS uses a server-first Next.js 16 App Router architecture. Browser React UI
and Firebase Web Auth handle presentation and sign-in. Next.js Server Actions
verify HTTP-only sessions, enforce authorization, and use Firebase Admin SDK for
trusted writes to Auth and Firestore. Firestore Security Rules protect direct
client SDK access.

Evidence: [Technical Architecture](TECHNICAL_ARCHITECTURE.md),
`lib/auth/session.ts`, `lib/firebase/admin.ts`, `firestore.rules`.

## 8. Technology stack

| Category | Final implementation |
| --- | --- |
| Programming language | TypeScript `^5` |
| Framework | Next.js `16.2.10` App Router |
| UI | React `19.2.4`, Tailwind CSS `^4`, daisyUI `^5.6.13`, Lucide React |
| Authentication | Firebase Authentication Web SDK `^12.15.0` |
| Database | Cloud Firestore |
| Privileged server access | Firebase Admin SDK `^14.1.0` |
| Forms | TanStack Form `^1.33.0` |
| Server-state management | TanStack Query `^5.101.2` |
| Testing | Node test runner via tsx, Firebase Emulator Suite, Firestore Rules Unit Testing, Playwright `^1.62.1`, axe-core Playwright `^4.12.1` |
| Hosting / demonstration | Vercel demo deployment, subject to the deployment record in `dev/VERCEL_DEPLOYMENT.md` |
| Version control / CI | Git, GitHub, GitHub Actions |

Evidence: `package.json` and `package-lock.json`.

## 9. Database / Firestore model

The active collections are `users`, `publicUsers`, `students`,
`clearanceRequirements`, `clearanceApplications`, `notifications`, and
`activityLogs`. Applications contain logical references to approval and remark
subcollections. Important fields include `studentUid`, `academicYear`,
`semester`, `overallStatus`, `financialStatus`, `deanApproved`, and
`printableAvailable`. Firestore is document-oriented and does not provide
relational foreign-key enforcement.

Evidence: `lib/types/firestore.ts`, `firestore.rules`,
`firestore.indexes.json`, diagram `07-firestore-data-model`.

## 10. Authentication and authorization

The browser signs in with Firebase Auth. The server creates/verifies an
HTTP-only session cookie, loads the Firestore profile, checks active status and
mandatory password state, and then authorizes the requested Server Action.
Firestore Rules independently restrict direct client reads and deny privileged
workflow writes. Test-session overrides are restricted to acceptance mode and
emulators.

Evidence: `lib/auth/session.ts`, `lib/auth/edge-session.ts`, `proxy.ts`,
`tests/rules/security-boundaries.test.ts`, `lib/auth/session-override.test.ts`.

## 11. Clearance workflow

The student submits one application per academic year/semester. The server
creates five required signatory rows: Librarian, OSA Coordinator, Guidance
Counselor, Area Chair, and Dean. The Accountant is not a sixth signatory;
financial status is stored directly on the application. Dean approval writes
the `deanApproved` flag.

Evidence: `app/actions/clearance.ts`, `lib/clearance/status.ts`,
`tests/integration/clearance-submission.test.ts`,
`tests/e2e/live-clearance-journey.spec.ts`, diagram `05-clearance-workflow`.

## 12. Financial accountability workflow

The Accountant sets `financialStatus` to `paid` or `unpaid` and must provide a
remark for an unpaid decision. A new application starts as `pending`. An
unpaid status prevents overall approval and therefore prevents the prototype
print output.

Evidence: `components/accountant/AccountantDashboard.tsx`,
`app/actions/clearance.ts`, `tests/integration/financial-workflow.test.ts`,
`tests/e2e/negative-workflow.spec.ts`.

## 13. Reporting and analytics

Admin reports are institution-wide and include financial summaries. Dean
reports are limited to Dean-approved applications and intentionally omit
financial summaries and financial detail columns. Filters canonicalize
academic terms, reject invalid statuses, enforce role scope, limit datasets to
5,000 applications, deduplicate contradictory records, and emit safe CSV.

Evidence: `app/actions/reports.ts`, `lib/reports/`,
`tests/integration/reports.test.ts`, `tests/e2e/reports.spec.ts`, diagram
`08-reporting-data-flow`.

## 14. Notifications and audit logs

Server Actions create user-scoped in-app notifications for submissions,
signatory actions, and financial updates. Activity logs record workflow and
administrative events; sensitive credential values are sanitized before
logging. Email delivery is deferred.

Evidence: `app/actions/notifications.ts`, `components/ui/NotificationDropdown.tsx`,
`app/actions/admin.ts`, `app/actions/admin-accounts.ts`.

## 15. Printable clearance output

`/student/clearance/[id]/print` renders an A4-oriented, PKM-slip-inspired digital
prototype record only when the derived overall status is `approved`. Its identity
block includes the academic term, student number, program, year, section, and
purpose. The record renders exactly five signatory rows (Librarian, OSA
Coordinator, Guidance Counselor, Area Chair, and Dean) with explicit Office /
Requirement, Status, Assigned Signatory, Remarks, and Date Reviewed columns,
followed by a separate `FINANCIAL ACCOUNTABILITY REVIEW` containing Status,
Verified By, Remarks, and Date Reviewed for the Accountant gate. The Dean is an
oversight role and is not printed as a signatory; the prototype does not reproduce
handwritten or electronic signatures. The page explicitly states that it is not
an official institutional certificate, receipt, or electronic signature.

Evidence: `app/student/clearance/[id]/print/page.tsx`,
`components/student/ClearanceCertificate.tsx`,
`tests/e2e/print-clearance.spec.ts`.

## 16. Testing methodology

Testing combines pure unit tests, Firebase Emulator integration, client-SDK
Firestore Rules tests, Playwright E2E journeys, axe accessibility scans,
responsive viewport checks, keyboard/dialog checks, print checks, and the
acceptance orchestrator. GitHub Actions runs the CI and Acceptance workflows
for `main`.

Evidence: `docs/dev/ACCEPTANCE_TESTING.md`, `docs/dev/UX_ACCESSIBILITY_QA.md`,
`.github/workflows/`.

## 17. Security controls

- HTTP-only session cookie; no `localStorage` session storage.
- Server-side role/status/session verification before privileged actions.
- Firestore Rules deny direct workflow writes and cross-student reads.
- Test session overrides require acceptance mode plus both emulator hosts.
- Admin lifecycle safeguards protect the final active administrator and prevent
  unsafe role conversion.
- Temporary passwords are generated server-side, never written to audit
  metadata, and force mandatory password change.
- CSV cells are neutralized against spreadsheet formula injection.
- Emulator seed/reset scripts refuse non-emulator environments.

Security controls are safeguards for this MVP, not a security certification.

## 18. Deployment / demonstration environment

For capstone demonstration and remote evaluation, the Next.js application may
be hosted on Vercel and connected to a dedicated Firebase demo environment
containing fictional data. The authoritative deployment status, URL, SHA, and
verification checks belong in [VERCEL_DEPLOYMENT.md](dev/VERCEL_DEPLOYMENT.md).
The local screenshot library remains emulator-based and deterministic.

## 19. Known limitations

- Capstone prototype/MVP scope; not official institutional production software.
- Fictional data only; no real student records.
- No email delivery, payment gateway, electronic signatures, or official
  certificate/receipt issuance.
- Firestore document limits and bounded report queries constrain scale.
- Remote demo availability depends on Firebase and Vercel configuration.
- Manual desktop/mobile accessibility evidence is only claimed when recorded.

## 20. Deferred features

- Bulk CSV Account Import.
- Email notification delivery.
- Payment gateway or online payment reconciliation.
- Electronic signatures and official certificate issuance.
- Self-service profile editing and automated email password delivery.
- Expanded analytics and post-MVP integrations.

## 21. Terminology and claims to avoid

Use "capstone prototype," "MVP," "demonstration deployment," and "fictional
data." Avoid "production-ready," "official PKM system," "certified," "official
certificate," "electronic signature," "real student data," and "security/WCAG
certified."

## Evidence matrix

| Manuscript claim | Source evidence | Test evidence | Diagram / visual evidence |
| --- | --- | --- | --- |
| Accountant is the financial gate | `app/actions/clearance.ts`, `components/accountant/AccountantDashboard.tsx` | `tests/integration/financial-workflow.test.ts` | `07-accountant-dashboard.png`, `08-accountant-financial-dialog.png`, `05-clearance-workflow.svg` |
| Dean approval writes the final signatory state | `app/actions/clearance.ts`, `app/actions/reports.ts` | `tests/integration/dean-visibility.test.ts` | `09-dean-clearance-queue.png`, `10-dean-review-dialog.png`, `05-clearance-workflow.svg` |
| Dean reports exclude financial summary | `app/actions/reports.ts`, `app/dean/reports/page.tsx` | `tests/integration/reports.test.ts`, `tests/e2e/reports.spec.ts` | `14-dean-reports.png`, `08-reporting-data-flow.svg` |
| Session and role checks are server-side | `lib/auth/session.ts`, `proxy.ts`, `app/actions/` | `lib/auth/*test.ts`, `tests/rules/security-boundaries.test.ts` | `06-auth-session-sequence.svg` |
| Print output is a prototype record | `app/student/clearance/[id]/print/page.tsx` | `tests/e2e/print-clearance.spec.ts` | `15-printable-clearance-prototype.png` |
