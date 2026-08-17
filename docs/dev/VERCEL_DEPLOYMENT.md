# ASCS Vercel Demonstration Deployment

## Status

This document is the non-secret deployment record for the ASCS capstone
demonstration environment. It must not be read as evidence of official PKM
production deployment. The deployed system, if enabled, uses fictional/demo
data only.

The emulator-only Demo account selector is intentionally absent from this
deployment because `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false`; remote users use
the normal Firebase login form and no remote password is exposed client-side.

| Field | Value |
| --- | --- |
| Vercel project | `ron-cada-projects/ascs` |
| Deployment URL | <https://ascs-one.vercel.app> |
| Latest production deployment | <https://ascs-hqa4eu7u9-ron-cada-projects.vercel.app> |
| Deployment ID | `dpl_6fH8ddsKDMfXStwxR7PkW63x4qua` |
| Deployment date | 2026-08-17 |
| Deployed Git SHA | `f58904ed90a005c55f6197c5184a960b6d54b420` (local `main` at deployment time) |
| Firebase demo project | `ascs11` (fictional demo data) |
| Firestore database | `(default)` in `asia-southeast1` |
| Demo mode | `NEXT_PUBLIC_DEMO_MODE=true` |
| Emulator mode | `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false` |
| Deployment protection | Vercel SSO remains enabled; no bypass secret or demo credentials are stored in the repository |

### Verification result

The production deployment is connected to the dedicated fictional Firebase
project `ascs11`. Public checks for `/` and `/login` returned HTTP 200. The
Production Firebase Admin variables are configured as encrypted Vercel
variables, and emulator host variables are absent.

The post-merge Firestore verification confirmed five ordered active roles
(Librarian, OSA Coordinator, Guidance Counselor, Area Chair, and Dean), an
inactive legacy Adviser requirement, five migrated applications with five
active approval roles each, retained legacy Adviser rows, Dean/Auth role
alignment, zero active `users`/`publicUsers` role mismatches, and a successful
`approvals.status == pending` collection-group query.

Vercel SSO protection is intentionally still enabled. The public
`npm run verify:vercel` command therefore remains suitable only for an
unprotected/custom-domain deployment, or for a run supplied with an approved
temporary SSO bypass and demo credentials. No bypass secret or credentials are
stored in this repository.

The authenticated `npm run verify:vercel` smoke passed against the aliased
Production deployment using the fictional Student, Librarian, Dean, and Admin
accounts with the test password supplied out-of-band. It exercised the
Student dashboard/logout, the Librarian pending queue, the actionable Dean
queue and review dialog, Admin Reports/logout, the demo banner, and confirmed
that no browser request targeted `127.0.0.1:8080` or `127.0.0.1:9099`. The
credential values were process-only and are not stored in Vercel or the
repository.

The current local development and screenshot environment uses Firebase Emulator
Suite project `ascs11` on Auth `127.0.0.1:9099` and Firestore
`127.0.0.1:8080`. Those emulator settings must never be configured on Vercel.

## Required Vercel variables

Client-visible variables:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
NEXT_PUBLIC_DEMO_MODE=true
```

Server-only variables:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
SESSION_COOKIE_NAME=ascs_session
```

Do not configure or expose these on Vercel:

```text
FIREBASE_AUTH_EMULATOR_HOST
FIRESTORE_EMULATOR_HOST
ASCS_ACCEPTANCE_TEST_MODE
TEST_SESSION_COOKIE
ASCS_ALLOW_REMOTE_DEMO_SEED
ASCS_REMOTE_DEMO_PASSWORD
```

Never commit `.env.local`, `.env.production`, service-account JSON, private
keys, Vercel tokens, or `.vercel/`.

## Remote Firebase safety gate

Before any remote seed or Firestore deployment, confirm the project is a
dedicated fictional/demo project. Do not seed or reset an unknown project.
Remote fixture creation must use a separate explicitly guarded script and
require all of the following:

```text
ASCS_ALLOW_REMOTE_DEMO_SEED=I_UNDERSTAND_THIS_WRITES_TO_REMOTE_FIREBASE
ASCS_REMOTE_DEMO_PROJECT_ID=<same value as FIREBASE_PROJECT_ID>
ASCS_REMOTE_DEMO_PASSWORD=<local-only secret, at least 12 characters>
```

The remote password must never be printed or committed. Existing emulator
scripts remain emulator-only and must not be repurposed for remote data.

## Deployment procedure

The procedure used for the verified deployment was:

1. Confirm the Vercel project `ron-cada-projects/ascs` and Firebase project
   `ascs11` as the fictional demo targets.
2. Configure the client variables, `NEXT_PUBLIC_DEMO_MODE=true`,
   `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false`, and the protected Firebase Admin
   variables in Vercel Production. Emulator host variables were not configured.
3. Deploy the merged `main` SHA using the authenticated Vercel CLI and record
   the resulting deployment ID and alias.
4. Deploy `firestore.rules` and `firestore.indexes.json` to the `(default)`
   Firestore database and wait for all indexes to reach `READY`.
5. Run the remote smoke test without starting the local Playwright web server
   when approved demo credentials or a temporary SSO bypass are available:

   ```bash
   VERCEL_BASE_URL=https://<verified-hostname> npm run verify:vercel
   ```

6. Record the project name, URL, deployment ID, Firebase demo project ID,
   deployed SHA, and verification results in this document.

## Verification checklist

- [x] `GET /` and `GET /login` load successfully.
- [x] Fictional Student can log in, reach the Student Dashboard, and log out.
- [x] Fictional Admin can log in, open Admin Reports, and log out.
- [x] An authenticated Server Action succeeds using session verification,
      Firebase Admin SDK, and Firestore.
- [x] Admin Reports load remotely.
- [x] Authenticated browser behavior shows no request to `127.0.0.1:8080` or
      `127.0.0.1:9099`.
- [x] Demo/Fictional Data banner is visible on an authenticated dashboard.
- [x] Firestore indexes are deployed, including the `approvals` collection-group
      `status` index and `deanApproved` application indexes.
- [x] Guarded Adviser-to-Dean migration applied and verified against `ascs11`.
- [x] Remote demo credentials are not present in the repository or public
      documentation.

## Non-production disclaimer

This Vercel deployment is a capstone demonstration environment using fictional
data and is not an official institutional production deployment.
