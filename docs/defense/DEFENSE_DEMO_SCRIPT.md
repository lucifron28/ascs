# ASCS Defense Demonstration Script

Target duration: 8-12 minutes. Use the local Firebase Emulator Suite and
fictional `@example.test` fixtures for the canonical demonstration. Reset the
emulator before rehearsal with `npm run demo:reset`.

## Preparation

```bash
npm run emulators
npm run demo:reset
npm run dev
```

Open `http://localhost:3000/login`, use Corporate theme, set browser zoom to
100%, and keep the demo disclaimer visible.

## Timed walkthrough

### 0:00 - Login and scope disclaimer

Use `student.g@example.test` / the local emulator password. Say that the data
is fictional and the application is a capstone MVP. Show the shared header,
notification control, theme selector, and logout control.

### 0:30 - Student submission

Open the Student Dashboard, open the submission form, choose the current
academic year/semester and purpose, then submit. Say that the server creates an
application, five approval rows, notifications, and an activity log in the
workflow transaction.

Expected result: the application appears in a pending state with financial
status pending.

### 1:30 - Signatory review

Log in as `guidance@example.test` (or use the assigned Librarian, OSA, Chair,
or Adviser account). Open the pending queue and the Review dialog. Show the
requirement context, remarks field, and the Approved/Pending/Not Approved
actions. Approve the selected requirement.

Say that remarks are required for pending and not-approved decisions and that
the Accountant is not a duplicate signatory row.

### 2:30 - Accountant financial gate

Log in as `accountant@example.test`. Open the financial queue and select the
application. In the Update Financial Account dialog, mark it Paid. Explain that
the financial state is stored directly on the application.

### 3:30 - Adviser unlock

Log in as `adviser@example.test`, approve the Adviser requirement, and explain
that this sets `adviserApproved`. If the live submission is taking too long,
switch to Student D or the pre-seeded Adviser-approved records.

### 4:30 - Dean visibility

Log in as `dean@example.test`. Show that the Dean queue contains only
adviser-approved applications. Open `/dean/reports` and point out that the
financial summary is intentionally absent.

### 5:30 - Final student state and print prototype

For a deterministic approved screen, log in as `student.a@example.test`. Show
the approved summary and open the printable clearance prototype. Point out the
five required signatory rows and the separate `FINANCIAL ACCOUNTABILITY REVIEW`.
State that it is an A4 MVP record and not an official institutional certificate
or electronic signature.

### 6:30 - Admin overview and user management

Log in as `admin@example.test`. Show the account overview, lifecycle status,
requirement assignment controls, and activity-log area. Explain that temporary
password reset forces a mandatory password change and that final-admin
protection is enforced server-side.

### 7:30 - Admin reports

Open `/admin/reports`. Show status totals, financial summary, bottlenecks,
breakdowns, filters, and CSV export. Explain that Admin scope is institution-wide
and bounded to 5,000 applications.

### 8:30 - Limitations and close

State the deferred features: bulk CSV import, email delivery, payment gateway,
electronic signatures, and official certificate issuance. Close by restating
that Vercel, if enabled, is a fictional-data demonstration deployment.

## Fallback scenarios

| Scenario | Account / state | Use |
| --- | --- | --- |
| Approved | `student.a@example.test` | Immediate approved dashboard and print prototype. |
| Pending | `student.b@example.test` | Pending signatory checklist. |
| Not approved | `student.c@example.test` | Remarks and blocked print action. |
| Unpaid | `student.d@example.test` | Financial hold despite approved signatories. |
| Mandatory password | `student.e@example.test` | Forced `/change-password` journey. |
| Inactive | `student.f@example.test` | Deactivated-account rejection. |
| Live journey | `student.g@example.test` | Fresh submission and sequential workflow. |

If a live click fails, reset with `npm run demo:reset`, switch to the matching
pre-seeded scenario, or show the canonical desktop screenshot library. Do not
modify Firebase configuration during the defense.
