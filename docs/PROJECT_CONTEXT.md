# Project Context

**Project Title:** Design of an Automated Student Clearance System with Integrated Financial Accountability Monitoring for Pambayang Kolehiyo ng Mauban

**Document Purpose:** Master planning and context file. Each phase of development begins with a plan derived from this document.

**Tech Stack:**
- Next.js App Router (TypeScript)
- Firebase (Authentication, Firebase SQL Connect / Cloud SQL PostgreSQL)
- Firebase Admin SDK (Trusted server-side operations)
- Tailwind CSS v4
- daisyUI v5
- TanStack Query v5
- TanStack Form
- Modern React and Next.js patterns (no deprecated APIs)

---

## 1. Project Overview

The **Automated Student Clearance System (ASCS)** is a web-based platform designed to digitize and automate the student clearance process at Pambayang Kolehiyo ng Mauban (PKM). It replaces manual paper-based clearance routing with a structured digital workflow where students submit applications online, designated signatories act on them via role-based dashboards, and the system enforces business rules automatically.

**Integrated Financial Accountability Monitoring** ensures that a student's financial obligations (e.g., unpaid fees, library fines, laboratory charges) are tracked and reflected in the clearance outcome. A clearance cannot reach full approval if financial obligations remain unresolved.

**Core purpose:**
- Reduce clearance processing time
- Enforce accountability among signatories
- Provide transparent, real-time clearance status to students
- Generate official printable clearance documents

---

## 2. Main System Outputs

### 2.1 Clearance Status Display
- Shows the student's current overall clearance status:
  - `Approved` — all signatories approved and financial status is Paid
  - `Pending` — default state; some signatories have not yet acted
  - `Not Approved` — at least one signatory rejected or an obligation is unresolved

### 2.2 Remarks Section
- Displays remarks explaining why a clearance is `Pending` or `Not Approved`
- Remarks are attached per signatory or per requirement
- Visible to the student and authorized roles

### 2.3 Clearance Tracking Interface
- Lists all required signatories
- Indicates which approvals are completed (with timestamp)
- Indicates which approvals are still pending or rejected

### 2.4 Financial Status Indicator
- Displays `Paid` or `Unpaid` for each student
- Updated by the Accountant role
- Unpaid status blocks overall clearance approval

### 2.5 Automated Notification Output
- System notifies the following signatories upon clearance submission:
  - Librarian
  - Accountant
  - OSA Coordinator
  - Guidance Counselor
  - Area Chair
  - Adviser
- Notifications also trigger on status changes (e.g., rejected, remarked)

### 2.6 Printable Clearance Document
- Available only when all conditions are met:
  - All signatory approvals completed
  - Financial status is `Paid`
- Generated as a formatted, printable document (HTML print view or PDF)

---

## 3. User Roles

| Role | Description |
|------|-------------|
| **Student** | Initiates and tracks clearance applications |
| **Librarian** | Reviews and approves/rejects library-related clearance |
| **Accountant** | Updates financial status (`Paid`/`Unpaid`); approves financial clearance |
| **OSA Coordinator** | Reviews and approves/rejects OSA-related clearance |
| **Guidance Counselor** | Reviews and approves/rejects guidance-related clearance |
| **Area Chair** | Reviews and approves/rejects department-level clearance |
| **Adviser** | Reviews and approves/rejects as faculty adviser; gate for Dean visibility |
| **Dean** | Views and processes clearance only after Adviser approval |
| **System Administrator** | Manages users, roles, system configuration, and audit logs |

---

## 4. Core Modules

### 4.1 Authentication
- Firebase Authentication (email/password)
- Role assignment on profile creation stored in PostgreSQL database profile table and/or Firebase custom claims
- Session management via Firebase JWT session cookies or token validation in middleware/Next.js proxy
- Protected routes enforced server-side via Next.js middleware and API authorization guards

### 4.2 Role-Based Dashboard
- Each role sees a dashboard scoped to their responsibilities
- Student sees their own clearance status and history
- Signatories see their pending approval queue
- Admin sees system-wide overview and user management

### 4.3 Student Clearance Application
- Form to initiate a clearance request
- Captures student info, purpose, academic year, semester
- Requires form completion before submission
- One active application at a time per student

### 4.4 Clearance Status Display
- Real-time status card: `Approved`, `Pending`, `Not Approved`
- Shows overall status derived from all signatory and financial statuses

### 4.5 Clearance Tracking
- Table/list of all required signatories
- Per-signatory status: `Approved`, `Pending`, `Not Approved`
- Timestamps for completed approvals

### 4.6 Remarks Management
- Signatories can add remarks when marking `Pending` or `Not Approved`
- Remarks stored per clearance approval record
- Student can view remarks on their tracking interface

### 4.7 Financial Accountability Monitoring
- Accountant dashboard shows students with active clearance applications
- Accountant updates financial status per student
- System blocks clearance approval if status is `Unpaid`
- Financial history tracked in `financial_records` table

### 4.8 Signatory Approval Workflow
- Each signatory reviews their own approval queue
- Actions: Approve, Mark Pending, Mark Not Approved (with required remarks)
- Actions trigger automatic re-evaluation of overall clearance status
- Notifications sent on relevant actions

### 4.9 Dean Visibility Control
- Dean's dashboard and queries exclude clearance records where Adviser has not yet approved
- Enforced at UI level (query filter) and API/Route Handler database query authorization level
- Adviser approval unlocks Dean view automatically

### 4.10 Notifications
- In-app notification list per role
- Triggered on: application submission, signatory action, financial status update
- Marked as read/unread
- Future: email notifications via Firebase Cloud Functions or third-party service

### 4.11 Printable Clearance Document
- Available only when overall status is `Approved`
- Renders a formatted clearance document (school header, student info, signatory table with signatures/dates)
- Accessible via a dedicated print route or modal

---

## 5. Clearance Workflow

```
1. Student submits clearance application.
      |
2. System creates a pending clearance record.
      |
3. System notifies all required signatories.
      |
4. Signatories review and take action:
   - Approve
   - Mark Pending (with optional remarks)
   - Mark Not Approved (with required remarks)
      |
5. Remarks shown to student when status is Pending or Not Approved.
      |
6. Accountant updates financial status to Paid or Unpaid.
      |
7. Adviser approval must be completed before Dean visibility unlocks.
      |
8. System automatically re-evaluates overall clearance status after each action.
      |
9. Printable clearance becomes available only after:
   - All required signatories have approved
   - Financial status is Paid
```

---

## 6. Status Logic

### Overall Clearance Status

| Status | Condition |
|--------|-----------|
| `Pending` | Default status after submission. One or more required signatories have not yet acted OR signatory action is `Pending`. |
| `Not Approved` | At least one required signatory has marked status as `Not Approved`, OR financial status is `Unpaid` after all signatories have acted. |
| `Approved` | All required signatories have individually approved AND financial status is `Paid`. |

### Precedence Rule
- `Not Approved` takes precedence over `Pending`
- `Approved` requires ALL conditions met simultaneously
- Any single `Not Approved` action blocks overall `Approved` status

---

## 7. Financial Accountability Logic

- **Values:** `Paid` | `Unpaid`
- **Responsible Role:** Accountant
- **Behavior:**
  - Default financial status on application submission: `Unpaid`
  - Accountant reviews student's financial obligations and updates status
  - `Unpaid` financial status **blocks** overall clearance from reaching `Approved`
  - Financial status is visible to:
    - The student (on their status display)
    - Accountant
    - Dean
    - System Administrator
- **Records:** Each update to financial status is stored as a record in `financial_records` for audit trail
- **Integration:** Financial status is treated as one of the required approval conditions in the overall status logic

---

## 8. Dean Visibility Rule

- The Dean **must not** see or process a clearance until the **Adviser** has approved it
- This rule is enforced at two levels:
  1. **UI Level:** Dean's dashboard query filters out records where Adviser approval is not `Approved`
  2. **API/Authorization Level:** Next.js Route Handler / Server Action queries enforce authorization rules restricting Dean's read access to records where the Adviser approval row has `status = 'approved'`
- Once Adviser approves, the clearance automatically becomes visible to the Dean without manual intervention
- This ensures the Adviser acts as the academic gatekeeper before administrative final review

---

## 9. Suggested Database Entities

> Note: These are planning-level proposals. PostgreSQL tables will be managed via Firebase SQL Connect.

### `profiles`
Links to Firebase Auth users. Stores user metadata.
- `id` (text, PK, matches Firebase Auth uid)
- `full_name` (text)
- `role` (enum: student, librarian, accountant, osa_coordinator, guidance_counselor, area_chair, adviser, dean, admin)
- `email` (text)
- `username` (text, unique)
- `account_status` (enum: active, inactive, deactivated)
- `must_change_password` (boolean)
- `contact_number` (text)
- `last_password_changed_at` (timestamptz)
- `deactivated_at` (timestamptz)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### `students`
Extended student-specific profile data.
- `id` (text, PK, FK -> profiles.id)
- `student_id_number` (text, unique)
- `program` (text)
- `year_level` (integer)
- `section` (text)
- `created_at` (timestamptz)

### `clearance_applications`
Each clearance request submitted by a student.
- `id` (uuid, PK)
- `application_number` (text, unique)
- `student_id` (text, FK -> students.id)
- `academic_year` (text)
- `semester` (text)
- `purpose` (text)
- `overall_status` (enum: pending, not_approved, approved)
- `submitted_at` (timestamptz)
- `updated_at` (timestamptz)

### `clearance_requirements`
Defines the set of required signatories/conditions for a clearance.
- `id` (uuid, PK)
- `role` (enum: matches signatory roles)
- `label` (text, e.g., "Library Clearance")
- `display_order` (integer, for display ordering)
- `is_active` (boolean)
- `assigned_signatory_id` (text, FK -> profiles.id)

### `clearance_approvals`
One row per signatory per clearance application. Tracks individual approval status.
- `id` (uuid, PK)
- `application_id` (uuid, FK -> clearance_applications.id)
- `requirement_id` (uuid, FK -> clearance_requirements.id)
- `signatory_role` (enum: matches signatory roles)
- `assigned_signatory_id` (text, FK -> profiles.id)
- `status` (enum: pending, approved, not_approved)
- `acted_at` (timestamptz)
- `updated_at` (timestamptz)

### `remarks`
Remarks attached to a specific clearance approval record.
- `id` (uuid, PK)
- `approval_id` (uuid, FK -> clearance_approvals.id)
- `author_id` (text, FK -> profiles.id ON DELETE SET NULL)
- `content` (text)
- `created_at` (timestamptz)

### `financial_records`
Tracks financial status per clearance application.
- `id` (uuid, PK)
- `application_id` (uuid, FK -> clearance_applications.id)
- `student_id` (text, FK -> students.id)
- `status` (enum: paid, unpaid)
- `notes` (text)
- `updated_by` (text, FK -> profiles.id ON DELETE SET NULL)
- `verified_at` (timestamptz)
- `recorded_at` (timestamptz)
- `updated_at` (timestamptz)

### `notifications`
In-app notifications for each user.
- `id` (uuid, PK)
- `recipient_id` (text, FK -> profiles.id)
- `type` (text, e.g., 'new_application', 'approval_action', 'financial_update')
- `message` (text)
- `related_application_id` (uuid, FK -> clearance_applications.id)
- `is_read` (boolean, default false)
- `created_at` (timestamptz)

### `activity_logs`
Audit trail for system actions.
- `id` (uuid, PK)
- `actor_id` (text, FK -> profiles.id)
- `action` (text)
- `entity_type` (text)
- `entity_id` (uuid)
- `metadata` (jsonb)
- `created_at` (timestamptz)

### `roles` (optional lookup table)
If roles are managed dynamically rather than as enums.
- `id` (uuid, PK)
- `name` (text, unique)
- `description` (text)

---

## 10. Suggested Next.js Route Structure

> Note: Routes are planned only. Implementation begins in Phase 4+.

```
app/
|-- (public)/
|   +-- page.tsx                     # Landing / login redirect
|
|-- (auth)/
|   |-- login/
|   |   +-- page.tsx                 # Login form
|   +-- logout/
|       +-- route.ts                 # Sign-out handler
|
|-- (student)/
|   |-- layout.tsx                   # Student layout + sidebar
|   |-- dashboard/
|   |   +-- page.tsx                 # Clearance status overview
|   |-- apply/
|   |   +-- page.tsx                 # Clearance application form
|   +-- clearance/
|       +-- [id]/
|           +-- page.tsx             # Clearance tracking detail
|
|-- (signatory)/
|   |-- layout.tsx                   # Shared signatory layout
|   |-- dashboard/
|   |   +-- page.tsx                 # Pending approvals queue
|   +-- clearance/
|       +-- [id]/
|           +-- page.tsx             # Individual clearance review
|
|-- (accountant)/
|   |-- layout.tsx
|   |-- dashboard/
|   |   +-- page.tsx                 # Financial overview
|   +-- student/
|       +-- [id]/
|           +-- page.tsx             # Update financial status
|
|-- (dean)/
|   |-- layout.tsx
|   |-- dashboard/
|   |   +-- page.tsx                 # Dean overview (Adviser-gated)
|   +-- clearance/
|       +-- [id]/
|           +-- page.tsx             # Full clearance review
|
+-- (admin)/
    |-- layout.tsx
    |-- dashboard/
    |   +-- page.tsx                 # System overview
    |-- users/
    |   +-- page.tsx                 # User management
    |-- requirements/
    |   +-- page.tsx                 # Manage clearance requirements
    +-- logs/
        +-- page.tsx                 # Activity logs
```

---

## 11. UI Planning

Using **Tailwind CSS v4** and **daisyUI v5** component primitives.

### Reusable Components

| Component | Description |
|-----------|-------------|
| `StatusBadge` | daisyUI badge colored by status: green=Approved, yellow=Pending, red=Not Approved |
| `FinancialStatusBadge` | daisyUI badge: green=Paid, red=Unpaid |
| `DashboardCard` | Summary card with icon, label, and value count |
| `TrackingTable` | Table listing signatories, their status badge, remarks, and timestamp |
| `ApprovalActionButtons` | Button group: Approve / Mark Pending / Not Approve (with remarks modal) |
| `RemarksPanel` | Collapsible panel showing remarks per signatory |
| `NotificationList` | Dropdown or sidebar panel with unread/read notifications |
| `PrintableClearance` | Print-optimized layout: school header, student details, signatory rows |
| `SidebarNav` | Role-scoped navigation sidebar using daisyUI menu component |
| `ApplicationForm` | TanStack Form-powered clearance application form |
| `RemarksForm` | Form for adding remarks on approval actions |
| `FinancialUpdateForm` | Form for Accountant to update financial status |

---

## 12. TanStack Query Usage Plan

TanStack Query v5 manages all server state (data fetching and caching via Next.js Route Handlers and Firebase SQL Connect / PostgreSQL).

| Query | Purpose |
|-------|---------|
| `useDashboardSummary` | Fetch counts for dashboard cards (pending, approved, not approved) |
| `useClearanceTracking` | Fetch signatory approval rows for a specific clearance application |
| `usePendingApprovals` | Fetch signatory's own pending approval queue |
| `useNotifications` | Fetch in-app notifications for the current user |
| `useFinancialRecords` | Fetch financial status and history for a student |
| `useClearanceApplication` | Fetch a single clearance application's full detail |
| `useStudentList` | Admin/Accountant list of students with clearance state |

### Mutations

| Mutation | Purpose |
|----------|---------|
| `useSubmitApplication` | POST new clearance application |
| `useApprovalAction` | PATCH clearance approval (approve / pending / not approved) |
| `useAddRemark` | POST a remark to an approval record |
| `useUpdateFinancialStatus` | PATCH financial status by Accountant |
| `useMarkNotificationRead` | PATCH notification read state |

### Invalidation Strategy
- After `useApprovalAction` -> invalidate `useClearanceTracking`, `useDashboardSummary`, `usePendingApprovals`
- After `useUpdateFinancialStatus` -> invalidate `useFinancialRecords`, `useClearanceTracking`
- After `useSubmitApplication` -> invalidate `useDashboardSummary`, `useStudentList`

---

## 13. TanStack Form Usage Plan

TanStack Form manages all user input forms with validation.

| Form | Fields | Notes |
|------|--------|-------|
| **Login Form** | email, password | Firebase Auth sign-in |
| **Clearance Application Form** | academic_year, semester, purpose, student confirmation | Validates completeness before submission |
| **Remarks Form** | content (required when status != approved) | Inline modal triggered by approval action |
| **Financial Status Update Form** | status (paid/unpaid), notes | Accountant use only |
| **Account Management Form** | full_name, program, year_level, section, student_id_number | Admin / student profile update |
| **Change Password Form** | current_password, new_password, confirm_password | Via Firebase Auth updatePassword |

---

## 14. Firebase & SQL Connect Usage Plan

### Auth
- Email/password authentication via Firebase Client SDK.
- Session managed server-side using Firebase Session Cookies (JWT) set in route handlers or secure Next.js middleware token verification.
- Roles stored in PostgreSQL `profiles` table and loaded on authentication. Custom claims can also be populated via Firebase Admin SDK.
- Admin-created user accounts. Students cannot self-register.

### Database (Firebase SQL Connect / PostgreSQL)
- Relational database schema implemented on a Cloud SQL PostgreSQL instance accessed via Firebase SQL Connect.
- Standard PostgreSQL connections or SDK queries managed in Next.js Server Components, Server Actions, or API Route Handlers.
- All direct database client code and credentials (such as service account keys) kept server-side to prevent credential leakage.
- Type definitions generated from the SQL Connect / PostgreSQL schema.

### Access Control & Authorization (Alternative to RLS)
- Access control enforced entirely server-side in API route handlers and Server Actions by checking:
  - User identity (validated via Firebase Admin SDK or middleware verifyIdToken).
  - User role (queried from the `profiles` database table).
- Dean authorization gate: Next.js API query handlers for Dean routes verify that the clearance application has Adviser approval before returning any student records.
- Signatory authorization: Signatories can only modify clearance approvals assigned to their role or user ID.

### Database Migration & Management
- Managed using standard PostgreSQL migration tools (e.g., Prisma Migrate, Drizzle Kit, or raw SQL migrations run via admin tools).
- No direct database writes from the frontend client. All mutations execute via Next.js Route Handlers or Server Actions executing SQL transactions.

### Firestore Decision
- Firestore will **not** be used as the primary database for ASCS.
- Reason: The system is relational and requires strict consistency between applications, approvals, financial records, roles, reports, and audit logs.
- Firestore may only be considered later for optional lightweight real-time notification feeds, but SQL Connect remains the source of truth.

---

## 15. Development Phases

### Phase 1 — Project Context and Implementation Plan (current)
- Create `docs/PROJECT_CONTEXT.md`
- Establish planning foundation
- No code implementation

### Phase 2 — Package Verification and Project Structure
- Verify installed packages match tech stack (Next.js, Firebase, Tailwind v4, daisyUI v5, TanStack Query v5, TanStack Form)
- Install missing packages (with user approval)
- Set up base folder structure: `components/`, `lib/`, `hooks/`, `types/`, `docs/`
- Configure Tailwind CSS v4 and daisyUI v5
- Set up TanStack Query provider
- Configure Firebase Client and Admin SDK utilities
- Create base middleware for auth session check and route protection

### Phase 3 — Firebase SQL Connect / PostgreSQL Schema Planning
- Finalize all table definitions for PostgreSQL
- Write and apply SQL migrations
- Generate TypeScript types from PostgreSQL schema
- Draft and review backend authorization query filters

### Phase 4 — Authentication and Role-Based Access
- Login page with TanStack Form
- Firebase Auth integration
- Middleware route protection by role
- Role-based redirect after login
- Profile setup for new users

### Phase 5 — Student Module
- Clearance application form (TanStack Form)
- Submit application and trigger notifications
- Student dashboard: status display, tracking table, remarks panel
- Financial status indicator on student view

### Phase 6 — Signatory Module
- Signatory dashboard: pending approval queue
- Clearance review page per application
- Approval action buttons with remarks form
- Remarks display on student tracking

### Phase 7 — Financial Accountability Module
- Accountant dashboard: student financial overview
- Financial status update form
- Financial history display
- Integration with clearance approval logic

### Phase 8 — Dean Visibility and Printable Clearance
- Dean dashboard with Adviser-gated clearance list
- Backend query-level enforcement for Dean visibility
- Printable clearance document view
- Print trigger (only when fully approved)

### Phase 9 — Notifications
- In-app notification list component
- Notification creation on key events (submission, approval action, financial update)
- Mark as read functionality
- Notification badge on sidebar nav

### Phase 10 — Activity Logs and Reports
- Admin activity log view
- Log entries on key system actions
- Summary reports: clearance counts by status, financial compliance rate

### Phase 11 — Testing and Polish
- End-to-end workflow testing
- Authorization validation
- UI consistency review (Tailwind v4 + daisyUI v5)
- Accessibility checks
- Performance review (TanStack Query caching, database query optimization)
- Final documentation updates

---

*Last updated: Phase 1 — Project Context and Implementation Plan*
*Source of truth: System requirements provided by project stakeholder.*

---

## 16. Git Workflow Rules

- **Branch Naming**: Follow conventional naming conventions (e.g., `feat/` for new features, `fix/` for bug fixes, `chore/` for configuration/setup). Format: `<type>/phase-<number>-<description>` (e.g., `feat/phase-2-setup`).
- **Commit Strategy**: Keep commits small, focused, and containing a single logical change. Make commits in small batches.
- **Workflow Process**:
  1. Create a new branch for the phase or subtask.
  2. Implement changes, making small commits.
  3. Once the branch/task is complete, push the branch to the remote repository (`https://github.com/lucifron28/ascs.git`).
  4. Notify the user to review the PR on GitHub.
  5. The user will merge the PR.
  6. Sync the merged changes back to the local branch/main before starting the next task.

