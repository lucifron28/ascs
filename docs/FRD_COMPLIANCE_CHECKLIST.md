# ASCS Functional Requirements Document (FRD) Compliance Checklist

**Institution:** Pambayang Kolehiyo ng Mauban (PKM)  
**Project:** Automated Student Clearance System (ASCS)  
**Evaluation Date:** August 7, 2026  
---

## Executive Summary

| Category | Implemented | Partial | Missing | Deferred | Total Evaluated |
| --- | --- | --- | --- | --- | --- |
| **Outputs** | 7 | 0 | 0 | 0 | 7 |
| **Roles** | 9 | 0 | 0 | 0 | 9 |
| **Functional Requirements** | 17 | 0 | 0 | 1 | 18 |
| **Overall Totals** | **33** | **0** | **0** | **1** | **34** |
---

## 1. Outputs Compliance

| Output | Status | Description & Evidence |
| --- | --- | --- |
| **Clearance Status Display** | `Implemented` | Shows real-time overall status (`pending`, `approved`, `not_approved`) and summary counts in `StatusSummary.tsx` & `TrackingTable.tsx`. |
| **Remarks Section** | `Implemented` | Displays mandatory remark history from `clearanceApplications/{id}/remarks` on student tracking and signatory modals. |
| **Clearance Tracking Interface** | `Implemented` | Student dashboard table (`TrackingTable.tsx`) details requirement sign-off matrix, acted date, assigned signatory, and latest remark. |
| **Financial Status Indicator** | `Implemented` | Dedicated `financialStatus` badge (`pending`, `paid`, `unpaid`) with accountant verification timestamp and financial remarks (ASCS tracks financial status and remarks, not an itemized dues ledger). |
| **Automated Notifications** | `Implemented` | In-app `NotificationDropdown.tsx` displays real-time notification items for student submissions (confirming to student and alerting assigned or role-wide signatories), signatory evaluations, and financial updates. |
| **Printable Clearance Document** | `Implemented` | `ClearanceCertificate.tsx` renders an A4-oriented PKM-slip-inspired digital prototype accessible exclusively when `overallStatus === 'approved'`, with five required signatory rows, a separate Accountant financial review, no reproduced signatures, and an explicit non-official-output disclaimer. |
| **Reports** | `Implemented` | `app/admin/reports/page.tsx` and `app/dean/reports/page.tsx` render role-scoped analytical dashboards, requirement bottleneck tables (`Highest Unresolved Requirements`), program/year-level/section breakdowns, completion rate metrics, and secure CSV exports (`exportAdminReportCsvAction`, `exportDeanReportCsvAction`) with activity audit logging. Enforces `assertReportScope` runtime scope allowlists, `parseReportFilterScope` scope validation, `assertReportDatasetWithinLimit` (5,000-application dataset guard), `fetchApprovalsInBatches` (`APPROVAL_BATCH_SIZE = 25`), strict status parsers (`parseApplicationStatus`), `deduplicateApplicationsById` conflict checks, Dean scope isolation (`adviserApproved === true`, no `financialSummary`), and CSV formula injection protection. |

### Details for Non-Implemented Outputs:
- None. All 7 Output requirements are fully implemented.
---

## 2. Roles Compliance

| Role | Status | Description & Evidence |
| --- | --- | --- |
| **Student** | `Implemented` | Can submit applications, view clearance status, track requirement checklist, read remarks, and print clearance certificate. |
| **Librarian** | `Implemented` | Accesses role-scoped pending queue for library requirements to approve, mark pending, or set not approved with mandatory remarks. |
| **Accountant** | `Implemented` | Financial gate only: accesses financial queue to verify student financial status and update status to `paid` or `unpaid`. |
| **OSA Coordinator** | `Implemented` | Accesses role-scoped queue for Office of Student Affairs clearance sign-off. |
| **Guidance Counselor** | `Implemented` | Accesses role-scoped queue for guidance department clearance sign-off. |
| **Area Chair** | `Implemented` | Accesses role-scoped queue for academic program clearance sign-off. |
| **Adviser** | `Implemented` | Reviews section/class clearance requirements; approval unlocks application visibility for the Academic Dean. |
| **Dean** | `Implemented` | Accesses adviser-approved applications queue (`adviserApproved === true`) for high-level academic clearance oversight. |
| **System Administrator** | `Implemented` | Manages system user roles, assigns requirement signatories, seeds demo accounts, and inspects activity audit logs. |

---

## 3. Functional Requirements Compliance

| Requirement | Status | Description & Evidence |
| --- | --- | --- |
| **Admin-created accounts** | `Implemented` | `createStudentAccountAction` and `createStaffAccountAction` execute atomic Firestore batches (`users`, `publicUsers`, `students`, `activityLogs`), feature full Auth deletion compensation on custom claim or Firestore write failure, use cryptographically secure passwords (`crypto.randomInt`), and require explicit server-side confirmation (`confirmElevatedAdminCreation`) for elevated admin creation. |
| **No student self-registration** | `Implemented` | Public registration is disabled; users authenticate against pre-created Firestore profiles. |
| **Student application submission** | `Implemented` | `submitApplicationAction` creates application and approval subdocuments in a Firestore transaction. |
| **Duplicate-term prevention** | `Implemented` | Enforces deterministic doc ID `{studentUid}_{academicYear}_{semester}`; duplicate submissions throw transactional error. |
| **Own-status tracking** | `Implemented` | Security rules restrict student reads to `studentUid == request.auth.uid`. |
| **Signatory queues** | `Implemented` | Signatories query role-matching pending approval subdocuments without scanning all applications. |
| **Approve / Pending / Not Approved actions** | `Implemented` | `signClearanceAction` executes atomic status updates. |
| **Required remarks** | `Implemented` | Server action enforces non-empty remarks when setting status to `pending` or `not_approved`. |
| **Accountant paid / unpaid verification** | `Implemented` | `updateFinancialStatusAction` updates direct application fields `financialStatus` and `financialVerifiedAt`. |
| **Unpaid blocks approval** | `Implemented` | `lib/clearance/status.ts` forces overall status to `not_approved` whenever `financialStatus === 'unpaid'`. |
| **Adviser unlocks Dean visibility** | `Implemented` | Dean queue query filters `adviserApproved == true`; setting adviser away from `approved` revokes Dean visibility. |
| **Dean is not a required signatory** | `Implemented` | Dean review is an oversight layer and is not included as a required approval row in the clearance matrix. |
| **Printable clearance after full approval** | `Implemented` | `fetchClearanceCertificateAction` blocks certificate generation unless `printableAvailable === true`. |
| **Notifications** | `Implemented` | Submissions, signatory actions, and financial updates write to `notifications` collection and appear in UI dropdown. |
| **Activity logging** | `Implemented` | Server actions write audit events in atomic Firestore batches and sanitize sensitive credential metadata via `sanitizeAuditMetadata`. |
| **User management** | `Implemented` | Admin user table displays accurate lifecycle data (`accountStatus`, `isActive`, `mustChangePassword`, `studentNumber`). `updateUserRoleAction` enforces `checkRoleConversion` (blocking student/staff conversion), protects the final active administrator, and preserves custom claims. |
| **Account deactivation** | `Implemented` | `deactivateUserAccountAction` and `reactivateUserAccountAction` synchronize Auth disabled status, revoke active refresh tokens, execute atomic Firestore updates and audit logging, protect the final active administrator from deactivation, and compensate step-by-step failures. |
| **Password reset & mandatory change** | `Implemented` | `resetUserTemporaryPasswordAction` issues cryptographically secure temporary passwords, revokes refresh tokens, preserves custom claims, and sets `mustChangePassword: true` with fallback profile sync and safe activity logging (`reset_temporary_password_fallback`). Mandatory password change is non-bypassable: profile retrieval is enabled via `getAuthenticatedUserForPasswordChange()`, session verification uses Edge-compatible X.509 certificates in `proxy.ts` (verified via real RS256 cryptographic tests in `edge-session.test.ts`), and normal actions are blocked by `getAuthenticatedUser()`. Completion requires server-verified credentials via `/api/auth/change-password` with `createPasswordChangedResponse` guaranteeing cookie clearance (`Max-Age=0`, `HttpOnly`, `SameSite=Lax`, `Cache-Control: no-store`) on all post-password responses (`passwordChanged: true`), safe logging via `logSafeAuthError` (allowlist context), and client recovery via `getPasswordChangeRecovery`. |

---

## 4. Evaluation & Next Steps for Non-Implemented Items

### Acceptance evidence (added without changing functional counts)

The FRD statuses above remain **33 Implemented / 1 Deferred**. Acceptance testing added
verification evidence, not new requirements:

- `tests/integration/` runs real server actions against the Auth + Firestore emulators and
  asserts persisted state for account lifecycle, mandatory password change, clearance
  submission, signatory workflow, the accountant financial gate, Adviser→Dean visibility,
  final approval/printability, reports, and CSV export audit logging.
- `tests/rules/security-boundaries.test.ts` verifies Firestore Rules with authenticated
  client SDKs (own-record reads allowed; cross-student reads and all privileged client
  writes denied).
- `tests/e2e/` covers the browser journeys: mandatory password change, approved/pending/
  not-approved/unpaid dashboards, and Admin/Dean reports (Dean financial-privacy boundary).
- The deterministic emulator dataset, safety guards, and seed/reset commands are documented
  in `docs/ACCEPTANCE_TESTING.md` and `docs/DEMO_SCENARIO.md`.

### Deferred Items:
1. **Bulk CSV Account Import:**
   - *Evidence:* Single account creation actions (`createStudentAccountAction`, `createStaffAccountAction`) are fully functional.
   - *Missing Behavior:* Bulk CSV user account upload wizard.
   - *Recommended Next Step:* Add CSV upload parser in post-MVP administrative tooling.
