# FRD Compliance Checklist

Status values: **Implemented** = evidenced in the current code; **Partial** =
the core path exists but an FRD edge or supporting workflow is incomplete;
**Missing** = not present; **Deferred** = intentionally outside the MVP.

## Required outputs

| FRD output | Status | Evidence / gap |
| --- | --- | --- |
| Clearance Status Display | Implemented | Student dashboard derives and displays pending, approved, and not approved states. Shared precedence is in `lib/clearance/status.ts`. |
| Remarks | Implemented | Pending/not-approved signatory actions and unpaid financial updates require remarks; history is stored under `remarks`. |
| Clearance Tracking | Implemented | Application approval rows show role, assignment, status, timestamp, and latest remark. |
| Financial Indicator | Implemented | `financialStatus` (`pending`, `paid`, `unpaid`) and the required audit fields live on `clearanceApplications`. |
| Notifications | Partial | Submission, approval, and financial updates create in-app notifications; email/push delivery and a complete notification UI are deferred. |
| Printable Clearance | Partial | Approved-only, PKM-branded prototype print view exists; it is explicitly not an official certificate and has placeholder seal/signature treatment. |

## Roles

| Role | Status | Current coverage |
| --- | --- | --- |
| Student | Implemented | Submit, track, see remarks/financial state, and access approved print view. |
| Librarian | Implemented | Role-scoped approval queue and signatory action. |
| Accountant | Implemented | Financial queue and paid/unpaid update with required unpaid remarks. |
| OSA Coordinator | Implemented | Role-scoped approval queue and signatory action. |
| Guidance Counselor | Implemented | Role-scoped approval queue and signatory action. |
| Area Chair | Implemented | Role-scoped approval queue and signatory action. |
| Adviser | Implemented | Role-scoped approval action and Adviser-gated Dean visibility. |
| Dean | Partial | Adviser-gated application view exists; full Dean approval/signature workflow remains limited in the MVP. |
| Admin | Partial | Role changes, requirement assignment, seeded data, and audit-log viewing exist. Account creation, deactivation, temporary-password reset, and complete lifecycle management are deferred. |

## Security and data rules

- **Implemented:** Firestore is the primary database; Admin SDK writes are used
  by Server Actions/Route Handlers; direct client workflow writes are denied.
- **Implemented:** `users` reads are owner/admin scoped; `publicUsers` is
  authenticated read-only; `students` are owner/admin/accountant/dean scoped.
- **Implemented:** direct client reads for applications, approvals, and remarks
  are owner/admin/accountant or adviser-gated Dean scoped; signatory workflow
  reads/writes go through verified Server Actions.
- **Implemented:** notifications are recipient-scoped and only `isRead` can be
  client-updated; activity logs are admin-readable and server-written.
- **Implemented:** session cookie name is centralized in `lib/auth/session.ts`
  (and its edge-safe name module) and profile lookup never fabricates a role.
- **Partial:** the optimistic proxy decodes role claims for redirects. Server
  authorization remains authoritative, but custom claims must be kept in sync
  with each Firestore profile change.

## Business-logic verification

- **Implemented:** `not_approved` takes precedence; all approvals approved plus
  `paid` is `approved`; all approved plus `unpaid` is `not_approved`; otherwise
  `pending`; printable availability is true only for `approved`.
- **Implemented:** signatory action accepts both `applicationId` and
  `approvalId`, verifies role and assignment, and leaves unassigned rows as
  role-wide queue items without silently assigning them.
- **Implemented:** submit, signatory, and financial status writes read the
  relevant application/approval snapshot before writing in a transaction.
- **Partial:** queue screens still fetch role queues through server-side scans;
  pagination and production-scale indexing remain follow-up work.

## Deferred / missing MVP items

- Admin-created staff/student accounts, deactivation, temporary-password reset,
  and password-change enforcement: **Deferred**.
- Email notifications, electronic signatures, official certificate issuance,
  and production hosting hardening: **Deferred**.
- Automated end-to-end tests and performance/load tests: **Missing**.
