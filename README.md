# Automated Student Clearance System (ASCS)

**Institution:** Pambayang Kolehiyo ng Mauban (PKM)  
**Project:** Automated Student Clearance System with Integrated Financial Accountability Monitoring  
**Status:** Capstone Prototype / MVP  

---

## Overview

The **Automated Student Clearance System (ASCS)** modernizes the clearance process for students at Pambayang Kolehiyo ng Mauban (PKM). It replaces paper-based routing slips with a digital workflow that provides real-time clearance tracking, five role-scoped signatory sign-offs, a separate Accountant financial accountability review, and an A4-oriented MVP print record. The print record is a PKM-slip-inspired digital prototype, not an official certificate or electronic signature.

---

## Architecture & Technology Stack

ASCS is built using a modern server-first architecture powered by Next.js and Firebase:

- **Framework:** [Next.js App Router](https://nextjs.org/) with React 19 & TypeScript
- **Database:** [Cloud Firestore](https://firebase.google.com/docs/firestore) (Primary Document Store)
- **Authentication:** [Firebase Authentication](https://firebase.google.com/docs/auth) & HTTP-only Session Cookies verified via [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- **Security:** Granular Firestore Security Rules + Server Action Authorization
- **Styling & UI:** Tailwind CSS v4, daisyUI v5, Lucide React Icons
- **Form & State:** TanStack Form & TanStack Query v5

For the source-aligned architecture, trust boundaries, data model, and implemented limitations, see [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md). The manuscript evidence map is in [`docs/MANUSCRIPT_ALIGNMENT.md`](docs/MANUSCRIPT_ALIGNMENT.md).

---

## Active Firestore Data Model

ASCS operates on nine core collections and subcollections:

- `users/{userId}` — Account profile, system role, and account status
- `publicUsers/{userId}` — Read-only display projection for active user lookup
- `students/{studentId}` — Academic profile, student ID number, program, year level, and section
- `clearanceRequirements/{requirementId}` — Configured clearance checklist items and optional signatory assignments
- `clearanceApplications/{applicationId}` — Clearance application record, term, overall status counters, and direct financial status fields
  - `clearanceApplications/{applicationId}/approvals/{approvalId}` — Role-specific sign-off status and assigned signatory
  - `clearanceApplications/{applicationId}/remarks/{remarkId}` — Immutable remark history
- `notifications/{notificationId}` — User-scoped in-app notifications
- `activityLogs/{logId}` — Audit log events written exclusively by server actions

---

## Roles & Responsibilities

1. **Student:** Submits term clearance applications, tracks sign-off progress, views remarks, and views the printable clearance summary upon full approval.
2. **Librarian:** Reviews library clearance requirements.
3. **Accountant:** Financial gate only. Verifies financial status (`paid` vs `unpaid`) on `clearanceApplications`. Marking `unpaid` requires a remark and blocks overall clearance approval. (Accountant does not have a duplicate signatory approval row).
4. **OSA Coordinator:** Reviews Office of Student Affairs clearance requirements.
5. **Guidance Counselor:** Reviews guidance department clearance requirements.
6. **Area Chair:** Reviews academic program / department clearance requirements.
7. **Dean:** Reviews and approves the fifth Dean Clearance requirement in the signatory queue.
8. **Reports:** Dean reports remain available separately and are scoped to Dean-approved applications.
9. **System Administrator:** Provisions student and staff accounts, manages user roles, deactivates/reactivates accounts, issues temporary passwords, assigns requirement signatories, and inspects activity logs.

---

## Local Development & Setup

### Prerequisites

- Node.js 20+ installed
- npm 10+ installed
- Java JDK / JRE 21+ installed (required by `firebase-tools ^15.26.0` for Firestore emulator execution)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/lucifron28/ascs.git
   cd ascs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Firebase Emulator Setup & Acceptance Testing

To run fully offline with local Firebase Auth and Firestore emulators:

1. Start the emulators:
   ```bash
   npm run emulators
   ```

2. Reset and seed the deterministic fictional dataset (in a separate terminal):
   ```bash
   npm run demo:reset
   ```

3. Run full automated acceptance verification (unit, lint, build, emulator integration, Firestore Rules, Playwright browser acceptance):
   ```bash
   npm run test:acceptance
   ```

The deterministic demo accounts and fictional records are documented in [`docs/DEMO_SCENARIO.md`](docs/DEMO_SCENARIO.md). The demo is emulator-only; it must not be seeded into a production Firebase project.

When both local switches are enabled, `/login` provides one accessible,
grouped Demo account selector for all seven student scenarios and eight staff
identities. It only fills deterministic emulator credentials and is hidden on
the public Vercel fictional-data deployment. Student profiles and applications
store the compact PKM **Program Code**; the shared catalog in
[`lib/academic-programs.ts`](lib/academic-programs.ts) supplies the canonical
**Program Name** for UI, reports, CSV output, and print output.

## Documentation, Diagrams, and Defense Assets

- [`docs/architecture/README.md`](docs/architecture/README.md) — architecture navigation
- [`docs/diagrams/README.md`](docs/diagrams/README.md) — eight self-contained PlantUML diagrams, with SVG and PNG renders
- [`docs/SCREENSHOT_INDEX.md`](docs/SCREENSHOT_INDEX.md) — reproducible 1440×900 Corporate-theme desktop screenshot index
- [`docs/CODEX_VISUAL_REFERENCE.md`](docs/CODEX_VISUAL_REFERENCE.md) — figure-ready visual references and fixture mapping
- [`docs/defense/DEFENSE_PRESENTATION_OUTLINE.md`](docs/defense/DEFENSE_PRESENTATION_OUTLINE.md) — defense slide plan
- [`docs/defense/DEFENSE_DEMO_SCRIPT.md`](docs/defense/DEFENSE_DEMO_SCRIPT.md) — timed live-demo script and fallback plan
- [`docs/defense/PANEL_QA.md`](docs/defense/PANEL_QA.md) — panel questions and evidence-based answers
- [`docs/defense/DEFENSE_CHECKLIST.md`](docs/defense/DEFENSE_CHECKLIST.md) — presentation-day checklist
- [`docs/dev/README.md`](docs/dev/README.md) — contributor, testing, QA, and deployment notes

Documentation commands:

```bash
npm run docs:diagrams
npm run docs:screenshots
npm run verify:docs
npm run verify:vercel
```

`docs:screenshots` targets a running local emulator-backed app and uses only fictional `@example.test` accounts. `verify:vercel` is a smoke check for a separately configured demo deployment; it never starts emulators or prints credentials.

---

## Required Environment Variables

Refer to `.env.example` for all configurable variables:

```env
# Firebase Web Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ascs11
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=ascs11
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Session Cookie Settings
SESSION_COOKIE_NAME=ascs_session

# Local Emulator & Demo Switches
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
NEXT_PUBLIC_DEMO_MODE=false
```

---

## Available Scripts

- `npm run dev` — Starts Next.js development server
- `npm run build` — Compiles and builds the production App Router bundle
- `npm run start` — Starts Next.js production server
- `npm run lint` — Runs ESLint checks across project files
- `npm test` — Executes automated unit tests for status derivation, lifecycle rules, session edge helpers, and reports
- `npm run test:integration` — Executes server-action integration tests & Firestore Rules tests against Firebase Emulator Suite
- `npm run test:e2e` — Runs Playwright Chromium browser acceptance tests
- `npm run test:acceptance` — Orchestrates all verification layers and writes `artifacts/acceptance-summary.json`
- `npm run demo:reset` — Resets emulator data, seeds deterministic fixtures, and verifies seed invariants
- `npm run demo:prepare` — Resets emulator, seeds fixtures, and prints the EMULATOR / DEMO ONLY demo account directory

---

## Security Notes

- Server actions verify session cookies and query Firestore user profiles to enforce authorization.
- Firestore Security Rules enforce zero direct client writes for workflow collections.
- Deactivated accounts (`accountStatus: 'inactive'` or `isActive: false`) are denied access to server actions and API routes.
- Custom claims and Firestore roles are kept in sync during administrator role updates.
- Test session overrides (`ASCS_ACCEPTANCE_TEST_MODE`) are strictly guarded and cannot activate in production.

---

## Known Limitations & MVP Disclaimer

- **Capstone MVP Notice:** This repository is a research prototype developed for Pambayang Kolehiyo ng Mauban. It is intended for testing, demonstration, and evaluation purposes.
- **Non-Production Disclaimer:** This system does not issue legal, binding institutional certificates, official electronic signatures, or production financial receipts.
- **Admin Tooling:** Batch CSV account import, self-service user profile editing, and email-based password delivery are deferred in this MVP build. Account creation and temporary password resets are performed via administrator server actions.
