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
- Java 21+ (required by firebase-tools ^15.26.0 for Firestore emulator execution)
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

Before the reset step, make sure `.env.local` contains the local emulator
switches below. The standalone reset/seed scripts preload this file, so no
manual PowerShell exports are required for the normal demo workflow:

```env
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
NEXT_PUBLIC_DEMO_MODE=true
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_PROJECT_ID=ascs11
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

When both `NEXT_PUBLIC_DEMO_MODE=true` and
`NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`, the login page shows one native
**Demo account** selector grouped into Students, Clearance Signatories,
Financial / Oversight, and Administration. Select an account to review its
role/scenario, email, description, and (for students) program, then choose
**Fill Demo Credentials**. The button only fills the form; it never logs in
automatically. The picker is emulator-only and is hidden on the public Vercel
fictional-data deployment, where the normal Firebase login form remains.

One command alternative for the whole demo environment:

```bash
npm run demo:prepare   # verifies emulator env, resets, seeds, prints accounts
```

---

## Demo accounts — EMULATOR / DEMO ONLY

All passwords are `password123` unless noted. These accounts exist only in the
local emulator and are intentionally fictional.

| Group / Role | Email | Password | Expected purpose |
| --- | --- | --- | --- |
| Students / Student A - Approved | `student.a@example.test` | `password123` | `BSAIS` - Accounting Information System; approved + paid, printable record |
| Students / Student B - Pending | `student.b@example.test` | `password123` | `BSMA` - Management Accounting; 2 approved / 3 pending |
| Students / Student C - Not Approved | `student.c@example.test` | `password123` | `BEED` - Bachelor of Elementary Education; librarian remark |
| Students / Student D - Unpaid Hold | `student.d@example.test` | `password123` | `CRIM` - Bachelor of Science in Criminology; financial hold |
| Students / Student E - Temporary Password | `student.e@example.test` | `password123` | `ENGLISH` - Bachelor of Arts in English; forced password change |
| Students / Student F - Inactive | `student.f@example.test` | `password123` | `ACP` - Agriculture Crop Production; Auth-disabled account |
| Students / Student G - Live Journey | `student.g@example.test` | `password123` | `FSM` - Food Service Management; end-to-end defense workflow |
| Clearance Signatories / Librarian | `librarian@example.test` | `password123` | Reviews the Library requirement |
| Clearance Signatories / OSA Coordinator | `osa@example.test` | `password123` | Reviews the Office of Student Affairs requirement |
| Clearance Signatories / Guidance Counselor | `guidance@example.test` | `password123` | Reviews the Guidance requirement |
| Clearance Signatories / Area Chair | `chair@example.test` | `password123` | Reviews the Academic Department requirement |
| Clearance Signatories / Adviser | `adviser@example.test` | `password123` | Reviews Adviser requirement and unlocks Dean visibility |
| Financial / Oversight / Accountant | `accountant@example.test` | `password123` | Separate financial accountability gate |
| Financial / Oversight / Dean | `dean@example.test` | `password123` | Read-only academic oversight after Adviser approval |
| Administration / System Administrator | `admin@example.test` | `password123` | User lifecycle, assignments, logs, reports |

The remaining supported catalog entries are `FILIPINO` (Bachelor of Arts in
Filipino), `MATH` (Bachelor of Science in Mathematics), and `SS` (Bachelor of
Arts in Social Studies). They remain available for future fictional records.

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
   Show the account list, roles, requirement assignments, and activity log. The
   Admin UI does not expose developer-only seed/reset commands; reset the
   fictional emulator dataset before the demonstration.
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

---

## Pre-Defense Checklist

Execute before commencing the live capstone presentation:

- [ ] Browser zoom level set to 100%
- [ ] Recommended desktop resolution available (1440x900 or 1920x1080)
- [ ] Firebase Auth emulator running (`http://127.0.0.1:9099`)
- [ ] Firestore emulator running (`http://127.0.0.1:8080`)
- [ ] Reset and seed completed (`npm run demo:reset` or `npm run demo:prepare`)
- [ ] Admin login verified (`admin@example.test`)
- [ ] Student G live workflow ready (for live 9-step clearance submission)
- [ ] Pre-approved Student A available as fallback for printable clearance
- [ ] Report pages verified (`/admin/reports` and `/dean/reports`)
- [ ] Presentation theme selected (`ASCS Light` or `ASCS Dark`)

---

## Mobile / Responsive Fallback Demonstration

If evaluators request a mobile or tablet demonstration:

1. Open Chrome DevTools (`F12` or `Ctrl+Shift+I`).
2. Toggle device toolbar (`Ctrl+Shift+M`) and select **iPhone SE (320px)** or **iPhone 14 (390px)**.
3. Observe responsive top navigation: branding and Notifications icon remain visible in the top bar, while navigation links, Theme Selector, and Logout collapse into the compact mobile menu button (`Menu` / `X`).
4. Open mobile navigation menu to access Dashboard, Reports, Theme Selector, and Logout.
5. Open Signatory or Accountant dashboard to show table horizontal scroll container and responsive modal dialog fitting the viewport without clipping action buttons.
