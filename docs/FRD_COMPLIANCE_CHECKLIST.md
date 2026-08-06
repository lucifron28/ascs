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
| **Functional Requirements** | 17 | 0 | 0 | 1 | 18 |
| **Overall Totals** | **32** | **0** | **0** | **2** | **34** |

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
| **Admin-created accounts** | `Implemented` | `createStudentAccountAction` and `createStaffAccountAction` provision Auth accounts, set custom claims, write Firestore profiles (`users`, `publicUsers`, `students`), and issue temporary passwords in Admin UI. |
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
| **User management** | `Implemented` | Admin dashboard supports creating student and staff accounts, updating user roles with Auth rollback, assigning requirement signatories, and filtering user records. |
| **Account deactivation** | `Implemented` | `deactivateUserAccountAction` and `reactivateUserAccountAction` toggle Auth disabled status, revoke active refresh tokens, update Firestore flags, and block inactive users from session creation and actions. |
| **Password reset** | `Implemented` | `resetUserTemporaryPasswordAction` issues a secure temporary password, revokes refresh tokens, and sets `mustChangePassword: true` which enforces mandatory password change at `/change-password`. |

---

## 4. Evaluation & Next Steps for Non-Implemented Items

### Deferred Items:
1. **Reports:**
   - *Evidence:* All application and approval data is stored structured in Firestore.
   - *Missing Behavior:* Aggregate department clearance completion rate reports and financial dues summaries.
   - *Recommended Next Step:* Implement an admin/dean analytics dashboard route under `/admin/reports` in post-MVP phase.

2. **Bulk CSV Account Import:**
   - *Evidence:* Single account creation actions (`createStudentAccountAction`, `createStaffAccountAction`) are fully functional.
   - *Missing Behavior:* Bulk CSV user account upload wizard.
   - *Recommended Next Step:* Add CSV upload parser in post-MVP administrative tooling.
