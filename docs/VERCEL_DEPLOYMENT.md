# ASCS Vercel Demonstration Deployment

## Status

This document is the non-secret deployment record for the ASCS capstone
demonstration environment. It must not be read as evidence of official PKM
production deployment. The deployed system, if enabled, uses fictional/demo
data only.

| Field | Value |
| --- | --- |
| Vercel project | Not yet verified in this repository audit |
| Deployment URL | Not yet verified |
| Deployment ID | Not yet verified |
| Deployment date | Not yet verified |
| Deployed Git SHA | Not yet verified |
| Firebase demo project | Must be explicitly confirmed before any remote write |
| Demo mode | Must be `NEXT_PUBLIC_DEMO_MODE=true` |
| Emulator mode | Must be `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false` |

### Current verification blocker

No Vercel deployment is claimed in this handoff. The repository has the Vercel
CLI installed, but no `VERCEL_TOKEN` or authenticated Vercel session is
available in the execution environment. Firebase CLI authentication can list
projects, but no dedicated fictional Firebase demo project has been confirmed:
the existing `ascs11` project is the local/emulator project, and its
read-only `firebase firestore:databases:list --project ascs11` check reports
that the Cloud Firestore API is disabled. It is therefore not treated as a
remote deployment target. An owner must authenticate Vercel (or connect the
repository in Vercel), confirm or provision a dedicated Firebase demo project,
configure protected variables, deploy the final pushed SHA, and then run the
smoke check below. Until those actions are completed, the local emulator
project `ascs11` is the only verified environment.

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

1. Confirm the Vercel account/project and exact Firebase demo project.
2. Configure only the variables above through Vercel's protected environment
   settings.
3. Deploy the final pushed Git SHA using the Vercel CLI or Git integration.
4. If Firebase Auth rejects the Vercel hostname, add only that exact hostname
   to Firebase Authentication Authorized domains.
5. Run the remote smoke test without starting the local Playwright web server:

   ```bash
   VERCEL_BASE_URL=https://<verified-hostname> npm run verify:vercel
   ```

6. Record the project name, URL, deployment ID, Firebase demo project ID,
   deployed SHA, and verification results in this document.

## Verification checklist

- [ ] `GET /` and `GET /login` load successfully.
- [ ] Fictional Student can log in, reach the Student Dashboard, and log out.
- [ ] Fictional Admin can log in, open Admin Reports, and log out.
- [ ] At least one authenticated Server Action succeeds using session
      verification, Firebase Admin SDK, and Firestore.
- [ ] Admin Reports load remotely.
- [ ] Browser behavior shows no request to `127.0.0.1:8080` or `127.0.0.1:9099`.
- [ ] Demo/Fictional Data banner is visible.
- [ ] Remote demo credentials are not present in the repository or public
      documentation.

## Non-production disclaimer

This Vercel deployment is a capstone demonstration environment using fictional
data and is not an official institutional production deployment.
