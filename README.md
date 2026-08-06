# Automated Student Clearance System (ASCS)

ASCS is a prototype/MVP for Pambayang Kolehiyo ng Mauban (PKM). It digitizes
student clearance submissions, role-based signatory review, financial
verification, adviser-gated Dean visibility, remarks, notifications, and a
print-friendly clearance record.

## Stack

- Next.js App Router and TypeScript
- Firebase Authentication (email/password)
- Cloud Firestore (primary database)
- Firebase Admin SDK for trusted server actions and route handlers
- Tailwind CSS, daisyUI, TanStack Form, and Firebase Emulator Suite

## Local setup

1. Install dependencies with Node.js and npm.
2. Copy `.env.example` to `.env.local` and fill the Firebase values.
3. Start the local app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000/login`.

For local-only development with the Firebase Emulator Suite:

```bash
firebase emulators:start
```

Set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`. The login server action can seed
the idempotent demo accounts when the emulator is running. The optional
quick-fill panel is shown only when `NEXT_PUBLIC_DEMO_MODE=true`.

## Environment variables

See `.env.example` for the complete list:

- `NEXT_PUBLIC_FIREBASE_*`: client Firebase configuration.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`:
  server-only Admin SDK credentials.
- `SESSION_COOKIE_NAME`: shared HTTP-only session cookie name (default:
  `ascs_session`).
- `NEXT_PUBLIC_USE_FIREBASE_EMULATOR`: connect client/Admin SDKs to local
  emulators.
- `NEXT_PUBLIC_DEMO_MODE`: opt in to demo credential quick-fill UI.

Never commit `.env.local`, service-account JSON, private keys, or production
credentials. The Firebase API key is a client identifier, but server
credentials must remain server-only.

## MVP scope

The MVP covers Student, Librarian, Accountant, OSA Coordinator, Guidance
Counselor, Area Chair, Adviser, Dean, and Admin workflows. Firestore Rules deny
direct workflow writes; Server Actions use the Admin SDK after session and
profile checks. The printable view is explicitly a prototype/MVP record and is
not an official school certificate.

## Known limitations

- Admin account creation, deactivation, temporary-password reset, and full
  account lifecycle management are deferred; the current admin module supports
  role changes, requirement assignment, seeded demo data, and audit logs.
- Notifications are in-app only; email delivery and electronic signatures are
  deferred.
- The local demo requires the Auth and Firestore emulators to be running when
  emulator mode is enabled.
- This repository does not claim production readiness or official PKM issuance.
