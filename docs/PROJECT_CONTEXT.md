# ASCS Project Context

**Project:** Automated Student Clearance System (ASCS)
**Institution:** Pambayang Kolehiyo ng Mauban (PKM)
**Purpose:** Active architecture and business context for the prototype/MVP.

## Architecture

- Next.js App Router with TypeScript, Tailwind CSS, daisyUI, TanStack Form, and Firebase SDKs.
- Firebase Authentication provides email/password identity.
- **Cloud Firestore is the primary database.** The active collections are:
  `users`, `publicUsers`, `students`, `clearanceRequirements`,
  `clearanceApplications`, `notifications`, and `activityLogs`.
- `clearanceApplications/{applicationId}` contains `approvals` and `remarks`
  subcollections.
- Clearance-level financial fields live on each application:
  `financialStatus`, `financialVerifiedAt`, `financialRemarks`,
  `financialUpdatedBy`, and `financialUpdatedByName`.
- The Firebase Admin SDK is the trusted server-side write layer. Firestore
  Security Rules protect direct client reads and writes. Server Actions and
  Route Handlers must verify the Firebase session cookie and the Firestore
  profile before accessing data.
- Client route/proxy checks are UX redirects only; they are not an
  authorization boundary. Authorization is enforced again in server code.

## Roles and responsibilities

| Role | Responsibility |
| --- | --- |
| Student | Submit and track a clearance application; view remarks and financial status |
| Librarian | Review library clearance approval |
| Accountant | Mark the application financially paid or unpaid |
| OSA Coordinator | Review Office of Student Affairs clearance |
| Guidance Counselor | Review guidance clearance |
| Area Chair | Review area/department clearance |
| Adviser | Review adviser clearance and unlock Dean visibility after approval |
| Dean | View adviser-approved applications for academic review |
| Admin | Manage profiles, roles, requirement assignments, and audit visibility |

## Workflow and status rules

1. A student submits one application for an academic year/semester.
2. The server creates the application, approval rows, submission notification,
   and activity log in a Firestore transaction.
3. Signatories act on their own role queue. An assigned approval can only be
   acted on by its assigned user; an unassigned row is a role-wide queue item.
4. Remarks are required for `pending` and `not_approved` decisions and are
   visible to the student.
5. The Accountant marks the application `paid` or `unpaid`; unpaid requires a
   remark and blocks approval.
6. Status is derived by `lib/clearance/status.ts`: `not_approved` wins; when
   every approval is approved, `paid` produces `approved`, `unpaid` produces
   `not_approved`; all other states are `pending`.
7. Printable output is available only when the derived status is `approved`.
   The print view is a prototype/MVP record and makes no official approval
   claim.
8. The Dean sees applications only after the Adviser approval is approved.

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
flows with in-app notifications and a print-friendly HTML record. Admin account
creation, deactivation, password reset, and complete account lifecycle tooling
remain deferred; the current admin module supports role changes, requirement
assignment, seeded demo data, and audit-log viewing. Email notifications,
electronic signatures, and production certificate issuance are also deferred.
