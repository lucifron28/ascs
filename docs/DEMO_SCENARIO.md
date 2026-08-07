# ASCS Defense / Demo Scenario

This guide prepares a repeatable, deterministic live demonstration of the
Automated Student Clearance System (ASCS) against the **Firebase Emulator
Suite** using fictional data only.

> **IMPORTANT:** Everything in this document runs against the local Firebase
> Emulator Suite. ASCS is a prototype/MVP and is **not production deployed**.
> All accounts, emails, and passwords below are **EMULATOR / DEMO ONLY** and
> must never be used with a real Firebase project.

---

## Setup

Requirements:

- Node.js 20+ (Node 20 is used in CI; Node 24 works locally)
- npm 10+
- Java 11+ (required by the Firestore emulator)
- Chromium via Playwright (for browser acceptance tests)

Install and prepare:

```bash
# 1. Install dependencies
npm ci

# 2. Install the Playwright Chromium browser (first time only)
npx playwright install chromium

# 3. Start the Firebase Emulator Suite (Auth :9099, Firestore :8080, Emulator UI)
npm run emulators
```

In a second terminal, reset and seed the deterministic fixture dataset:

```bash
# 4. Clear + reseed the emulator with the fictional dataset (verify invariants)
npm run demo:reset
```

Then start the application connected to the emulators:

```bash
# 5. Start Next.js (reads emulator env automatically in dev mode)
npm run dev
```

Open http://localhost:3000/login.

One command alternative for the whole demo environment:

```bash
npm run demo:prepare   # verifies emulator env, resets, seeds, prints accounts
```

---

## Demo accounts — EMULATOR / DEMO ONLY

All passwords are `password123` unless noted. These accounts exist only in the
local emulator and are intentionally fictional.

| Role | Email | Password | Expected purpose |
| --- | --- | --- | --- |
| System Administrator | `admin@example.test` | `password123` | Account overview, reports, CSV export |
| Academic Dean | `dean@example.test` | `password123` | Adviser-approved visibility + Dean report privacy |
| Librarian | `librarian@example.test` | `password123` | Approve librarian clearance |
| Accountant | `accountant@example.test` | `password123` | Financial gate (paid/unpaid) |
| OSA Coordinator | `osa@example.test` | `password123` | Approve OSA clearance |
| Guidance Counselor | `guidance@example.test` | `password123` | Approve guidance clearance |
| Area Chair | `chair@example.test` | `password123` | Approve area clearance |
| Adviser | `adviser@example.test` | `password123` | Approve adviser clearance, unlock Dean visibility |
| Student A | `student.a@example.test` | `password123` | Fully approved + paid, printable clearance available |
| Student B | `student.b@example.test` | `password123` | Pending: 2 approved / 3 pending |
| Student C | `student.c@example.test` | `password123` | Not approved: librarian remark (unreturned book) |
| Student D | `student.d@example.test` | `password123` | Unpaid financial hold, all signatories approved |
| Student E | `student.e@example.test` | `password123` | Temporary password: must change on first login |
| Student F | `student.f@example.test` | `password123` | Inactive/deactivated account (disabled in Auth) |

**Seeded application state (2026-2027, 1st Semester):**

| Application | Overall | Financial | Printable |
| --- | --- | --- | --- |
| `app-student-a` (A) | approved | paid | yes |
| `app-student-b` (B) | pending | paid | no |
| `app-student-c` (C) | not_approved | paid | no |
| `app-student-d` (D) | not_approved | unpaid | no |

---

## Suggested live-defense flow

Keep the demo under ~15 minutes. Reset first so every run starts identical:

```bash
npm run demo:reset   # or: npm run demo:prepare
```

1. **Admin dashboard / account overview** — log in as
   `admin@example.test`; show the account list, roles, and activity log.
   Note the Database Operations card points to `npm run demo:reset` (seeding
   is CLI-managed, not in-app).
2. **Student pending application** — log in as `student.b@example.test`;
   show the pending signatory checklist (Librarian + OSA approved, 3 pending).
3. **Signatory approval** — log in as `guidance@example.test` (or
   `chair@example.test` / `adviser@example.test`) and approve the pending
   requirement; switch back to Student B to show the updated counters.
   For a remark path, mark one requirement `not approved` with remarks and
   show the student-visible remarks log.
4. **Accountant financial verification** — log in as
   `accountant@example.test`; show the financial queue, mark Student D
   `paid` (or flip Student A to `unpaid` with remarks to show the hold).
5. **Adviser unlock** — as `adviser@example.test`, approve Student B's
   adviser requirement; the Dean queue now includes Student B.
6. **Dean visibility** — log in as `dean@example.test`; show only
   adviser-approved records (A, B, D), no financial data.
7. **Final approved student** — finish the remaining signatories for
   Student B and confirm `overallStatus = approved`.
8. **Printable clearance preview** — as Student B, open the print/preview
   record. It is a prototype record, **not an official PKM certificate**.
9. **Admin reports** — as `admin@example.test`, open `/admin/reports`;
   verify fixture totals, financial summary, bottleneck table, CSV export.
10. **Dean report privacy boundary** — as `dean@example.test`, open
    `/dean/reports`; confirm no financial summary and only adviser-approved
    data; export the Dean CSV (no financial columns).

**Optional security beat (mandatory password change):** log in as
`student.e@example.test` and show that the system forces `/change-password`,
rejects direct dashboard navigation, and re-logs-in with the new password.

---

## Fallbacks if a live browser interaction fails

- **Run the full automated acceptance suite** instead of the live walkthrough:
  ```bash
  npm run test:acceptance
  ```
  This verifies unit, emulator integration, Firestore rules, and browser
  acceptance layers and writes `artifacts/acceptance-summary.json`.
- **Reset mid-demo:** if a state gets out of sync, run `npm run demo:reset`
  (requires emulators running) and continue from step 1. Every run is
  deterministic.
- **Screenshots:** Playwright captures `test-results/` screenshots and traces
  on failure; the HTML report (`npx playwright show-report`) can be shown
  instead of live clicks.
- **Prepared data states:** the seeded fixtures already contain the four
  canonical states (approved / pending / not_approved / unpaid) — you can jump
  to the dashboard of Student A/B/C/D to demonstrate any of them without
  performing the live workflow.
