# ASCS Database Seeding Plan

This document outlines the seeding strategy and data requirements for the Automated Student Clearance System (ASCS).

---

## 1. Safety Warning & Safeguards

> [!CAUTION]
> **NEVER run seeding scripts against a production Firebase project.**
> Seeding scripts perform destructive operations (deleting existing clearance applications, creating dummy users, resetting states).
> Always verify that your active configuration (`.env.local` or environment variables) points to either the **Local Emulator** or a dedicated **Development Project**.

To prevent accidental production execution, the seeding action verifies:
- If `process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== 'true'` and the Firebase project ID is NOT a development/staging project, the execution must abort.

---

## 2. Default Clearance Requirements

To bootstrap the checklist system, the following requirements must be seeded in the `clearanceRequirements` collection:

1. **Librarian Clearance** (Signatory Role: `librarian`, Display Order: `1`)
2. **Financial Accountability Monitoring** (Signatory Role: `accountant`, Display Order: `2`)
3. **Office of Student Affairs Clearance** (Signatory Role: `osa_coordinator`, Display Order: `3`)
4. **Guidance and Counseling Clearance** (Signatory Role: `guidance_counselor`, Display Order: `4`)
5. **Academic Department Clearance** (Signatory Role: `area_chair`, Display Order: `5`)
6. **Adviser Review** (Signatory Role: `adviser`, Display Order: `6`)

*Note: The Dean is not a required signatory for MVP. Dean access is read-only and restricted by the `adviserApproved` flag.*

---

## 3. Demo User Accounts

Seeding must create the following demo accounts in Firebase Authentication and populate their corresponding profiles in the `users` and `students` collections. 

### Signatory & Staff Users (`users/{userId}`)
All password credentials for demo accounts should default to `password123`.

| Full Name | Role | Email |
|---|---|---|
| Admin User | `admin` | `admin@pkm.edu.ph` |
| Librarian Staff | `librarian` | `librarian@pkm.edu.ph` |
| Accountant Staff | `accountant` | `accountant@pkm.edu.ph` |
| OSA Coordinator | `osa_coordinator` | `osa@pkm.edu.ph` |
| Guidance Counselor | `guidance_counselor` | `guidance@pkm.edu.ph` |
| Area Chair Staff | `area_chair` | `areachair@pkm.edu.ph` |
| Academic Adviser | `adviser` | `adviser@pkm.edu.ph` |
| College Dean | `dean` | `dean@pkm.edu.ph` |

### Student User (`users/{userId}` + `students/{studentId}`)
| Full Name | Student Number | Program | Year/Section | Email |
|---|---|---|---|---|
| Juan Dela Cruz | `STUD-2026-0001` | `BSIT` | `4th Year - Section A` | `student@pkm.edu.ph` |

---

## 4. Simplified Financial Seeding (ASCS Scope Only)

> [!IMPORTANT]
> **Ledger/spreadsheet data is not part of ASCS.**
> There are **no** transaction categories, transaction logs, or template row uploads to seed.
> Seeding only ensures that the student's initial application is created with:
> - `financialStatus = 'pending'`
> - `overallStatus = 'pending'`
> - `printableAvailable = false`

---

## 5. Execution Strategy

### Local Emulator Seeding
When running the local Firebase Emulator Suite:
1. Run the local dev server: `npm run dev`.
2. Access the Login screen at `http://localhost:3000/login`.
3. Use the "Seed Database" button on the UI (available in development mode) to trigger the `seedDatabaseAction` server action.
4. The server action will automatically bootstrap all the users in Auth (using the Admin SDK `createUser` interface) and seed the requirements in Firestore.

### Dev Firebase Project Seeding
When deploying or testing against a cloud development project:
- Trigger the seeding via the same Admin action on the dev deployment.
- Ensure the `.env.local` contains correct cloud project credentials (project ID, client email, and private key).
