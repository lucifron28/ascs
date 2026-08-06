# ASCS Functional Requirements Document (FRD) Compliance Checklist

**Institution:** Pambayang Kolehiyo ng Mauban (PKM)  
**Project:** Automated Student Clearance System (ASCS)  
**Evaluation Date:** August 6, 2026  

---

## Executive Summary

| Category | Implemented | Partial | Missing | Deferred | Total Evaluated |
| --- | --- | --- | --- | --- | --- |
| **Outputs** | 6 | 0 | 0 | 1 | 7 |
| **Roles** | 9 | 0 | 0 | 0 | 9 |
| **Functional Requirements** | 13 | 2 | 1 | 2 | 18 |
| **Overall Totals** | **28** | **2** | **1** | **3** | **34** |

---

## 1. Outputs Compliance

| Output | Status | Description & Evidence |
| --- | --- | --- |
| **Clearance Status Display** | `Implemented` | Shows real-time overall status (`pending`, `approved`, `not_approved`) and summary counts in `StatusSummary.tsx` & `TrackingTable.tsx`. |
| **Remarks Section** | `Implemented` | Displays mandatory remark history from `clearanceApplications/{id}/remarks` on student tracking and signatory modals. |
| **Clearance Tracking Interface** | `Implemented` | Student dashboard table (`TrackingTable.tsx`) details requirement sign-off matrix, acted date, assigned signatory, and latest remark. |
| **Financial Status Indicator** | `Implemented` | Dedicated `financialStatus` badge (`pending`, `paid`, `unpaid`) with accountant verification timestamp and financial remarks (ASCS tracks financial status and remarks, not an itemized dues ledger). |
| **Automated Notifications** | `Implemented` | In-app `NotificationDropdown.tsx` displays real-time notification items for student submissions (confirming to student and alerting assigned or role-wide signatories), signatory evaluations, and financial updates. |
| **Printable Clearance Document** | `Implemented` | `ClearanceCertificate.tsx` renders print-ready MVP document accessible exclusively when `overallStatus === 'approved'`. |
| **Reports** | `Deferred` | Advanced statistical reporting, batch PDF export, and aggregate clearance analytics. |

### Details for Non-Implemented Outputs:
- **Reports:**
  - *Evidence:* No dedicated reports page or CSV/PDF analytics export in current App Router routes.
  - *Missing Behavior:* Aggregate department clearance completion rate reports and financial dues summaries.
  - *Recommended Next Step:* Implement an admin/dean analytics dashboard route under `/admin/reports` in post-MVP phase.

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
| **Admin-created accounts** | `Missing` | Administrator user profile creation form is unbuilt; accounts are provisioned via `seedDatabaseAction()` or Firebase Auth CLI. |
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
| **Activity logging** | `Implemented` | Server actions write audit events directly to `activityLogs` collection. |
| **User management** | `Partial` | Admin dashboard supports changing user roles and custom claims; user profile creation form is unbuilt. |
| **Account deactivation** | `Partial` | Server auth check blocks `accountStatus === 'inactive'`; admin UI UI button for deactivation toggle is unbuilt. |
| **Password reset** | `Deferred` | Admin-initiated temporary password reset tooling. |

---

## 4. Evaluation & Next Steps for Non-Implemented Items

### Partial Items:
1. **User Management:**
   - *Evidence:* `updateUserRoleAction` updates user roles and Firebase Auth custom claims.
   - *Missing Behavior:* No admin UI modal to create a new user profile or edit user contact details.
   - *Recommended Next Step:* Build `/admin/users/new` modal for creating user profiles.

2. **Account Deactivation:**
   - *Evidence:* Backend session handler `getAuthenticatedUser()` strictly denies access to `accountStatus === 'inactive'`.
   - *Missing Behavior:* Admin dashboard user table lacks an explicit toggle button to flip `accountStatus` between `active` and `inactive`.
   - *Recommended Next Step:* Add an `Deactivate Account` / `Reactivate Account` action button in `AdminDashboard.tsx`.

### Missing Items:
1. **Admin-Created Accounts:**
   - *Evidence:* Demo accounts are seeded via `seedDatabaseAction()`.
   - *Missing Behavior:* Admin UI user account creation form / modal.
   - *Recommended Next Step:* Implement `/admin/users/create` modal for provisioning staff and student accounts.
2. **Password Reset:**
   - *Evidence:* Password authentication uses standard Firebase Auth.
   - *Missing Behavior:* Admin button to issue a temporary password or send a password reset link.
   - *Recommended Next Step:* Integrate `sendPasswordResetEmail` in admin dashboard.

3. **Reports:**
   - *Evidence:* All application and approval data is stored structured in Firestore.
   - *Missing Behavior:* Printable aggregate report sheets for institutional archives.
   - *Recommended Next Step:* Add CSV export action in post-MVP release.
