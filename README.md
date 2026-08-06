# Automated Student Clearance System (ASCS)

**Institution:** Pambayang Kolehiyo ng Mauban (PKM)  
**Project:** Automated Student Clearance System with Integrated Financial Accountability Monitoring  
**Status:** Capstone Prototype / MVP  

---

## Overview

The **Automated Student Clearance System (ASCS)** modernizes the clearance process for students at Pambayang Kolehiyo ng Mauban (PKM). It replaces paper-based routing slips with a digital workflow that provides real-time clearance tracking, role-scoped signatory sign-offs, integrated accountant financial accountability verification, and an MVP print-friendly clearance summary.

---

## Architecture & Technology Stack

ASCS is built using a modern server-first architecture powered by Next.js and Firebase:

- **Framework:** [Next.js App Router](https://nextjs.org/) with React 19 & TypeScript
- **Database:** [Cloud Firestore](https://firebase.google.com/docs/firestore) (Primary Document Store)
- **Authentication:** [Firebase Authentication](https://firebase.google.com/docs/auth) & HTTP-only Session Cookies verified via [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- **Security:** Granular Firestore Security Rules + Server Action Authorization
- **Styling & UI:** Tailwind CSS v4, daisyUI v5, Lucide React Icons
- **Form & State:** TanStack Form & TanStack Query v5

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
3. **Accountant:** Verifies financial status (`paid` vs `unpaid`). Marking `unpaid` requires a remark and blocks overall clearance approval.
4. **OSA Coordinator:** Reviews Office of Student Affairs clearance requirements.
5. **Guidance Counselor:** Reviews guidance department clearance requirements.
6. **Area Chair:** Reviews academic program / department clearance requirements.
7. **Adviser:** Reviews section/class adviser clearance requirements. Approval unlocks application visibility for the Dean.
8. **Dean:** Conducts final academic review on adviser-approved clearance applications.
9. **System Administrator:** Manages user roles, assigns requirement signatories, seeds demo data, and views system activity logs.

---

## Local Development & Setup

### Prerequisites

- Node.js 20+ installed
- npm 10+ installed
- Java Runtime Environment (JRE 11+) for running Firebase Emulators (optional for local testing)

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

## Firebase Emulator Setup

To run fully offline with local Firebase Auth and Firestore emulators:

1. Install Firebase CLI globally (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Start the emulators:
   ```bash
   firebase emulators:start
   ```

3. Enable emulator mode in `.env.local`:
   ```env
   NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
   NEXT_PUBLIC_DEMO_MODE=true
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
   FIREBASE_PROJECT_ID=ascs11
   ```

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

---

## Security Notes

- Server actions verify session cookies and query Firestore user profiles to enforce authorization.
- Firestore Security Rules enforce zero direct client writes for workflow collections.
- Deactivated accounts (`accountStatus: 'inactive'` or `isActive: false`) are denied access to server actions and API routes.
- Custom claims and Firestore roles are kept in sync during administrator role updates.

---

## Known Limitations & MVP Disclaimer

- **Capstone MVP Notice:** This repository is a research prototype developed for Pambayang Kolehiyo ng Mauban. It is intended for testing, demonstration, and evaluation purposes.
- **Non-Production Disclaimer:** This system does not issue legal, binding institutional certificates, official electronic signatures, or production financial receipts.
- **Admin Tooling:** Admin user creation, self-service password reset, and full account lifecycle management are deferred in this MVP build.
