# ASCS Defense Presentation Outline

Target length: approximately 12-15 slides, followed by the live demonstration.
Use SVG diagrams for architecture slides and screenshots only for real UI
behavior. Keep slide text concise; use the speaker notes below for explanation.

## Slide 1 - Title

Talking points:

- Automated Student Clearance System with Integrated Financial Accountability
  Monitoring.
- Pambayang Kolehiyo ng Mauban capstone/research MVP.
- Presenters, adviser, and date.

Visual: no code; use a restrained title layout.

Speaker notes: State immediately that the system is a prototype using fictional
data and is not an official institutional production system.

## Slide 2 - Problem and existing process

Talking points:

- Paper routing makes status and accountability difficult to track.
- Students need repeated follow-ups with multiple offices.
- Financial accountability is often disconnected from clearance visibility.

Visual: a simple before/after process sketch or `01-system-context.svg`.

Speaker notes: Frame ASCS as process coordination and visibility, not merely a
replacement for a paper form.

## Slide 3 - Project objective and scope

Talking points:

- Digitize submission and role-scoped review.
- Integrate an Accountant financial gate.
- Provide Adviser-gated Dean oversight and scoped reports.
- Preserve a prototype print record for approved cases.

Visual: `05-clearance-workflow.svg`.

Speaker notes: Name deferred items: bulk CSV import, email delivery, payment
gateway, electronic signatures, and official certificate issuance.

## Slide 4 - Users and responsibility boundaries

Talking points:

- Student and five clearance signatories.
- Accountant as a financial gate, not a duplicate signatory.
- Adviser approval unlocks Dean visibility.
- Dean is academic oversight, not a required approval row.
- Admin owns account, requirement, log, and report administration.

Visual: `04-role-rbac.svg`.

## Slide 5 - Technical architecture

Talking points:

- Browser React client and Firebase Web Auth.
- Next.js App Router and Server Actions.
- Firebase Admin SDK for trusted server operations.
- Cloud Firestore and Firestore Rules boundary.

Visual: `02-container-architecture.svg`.

Speaker notes: Distinguish UI/navigation checks from server authorization.

## Slide 6 - Authentication and security

Talking points:

- Firebase sign-in produces an ID token.
- Server session is an HTTP-only cookie.
- Server Actions re-verify session and Firestore profile.
- Inactive and must-change-password accounts are blocked.
- Rules deny direct privileged writes.

Visual: `06-auth-session-sequence.svg`.

## Slide 7 - Student clearance workflow

Talking points:

- Student submits one application per canonical academic term.
- Five signatory rows are created transactionally.
- Remarks are required for pending/not-approved decisions.
- Status is derived from signatory rows and financial state.

Visual: `05-clearance-workflow.svg`, plus `02-student-dashboard-approved.png`.

## Slide 8 - Financial accountability workflow

Talking points:

- New applications begin with financial status pending.
- Accountant marks paid or unpaid with required remarks for unpaid.
- Unpaid blocks overall approval and printability.

Visual: `08-accountant-financial-dialog.png`.

Speaker notes: Explain why a separate gate avoids treating financial checking as
a duplicate signatory row.

## Slide 9 - Adviser and Dean oversight

Talking points:

- Adviser approval sets `adviserApproved`.
- Dean queue and Dean reports filter to adviser-approved applications.
- Dean reports exclude financial summaries and financial detail.

Visual: `09-adviser-dashboard.png`, `10-dean-dashboard.png`,
`14-dean-reports.png`.

## Slide 10 - Admin functions and reports

Talking points:

- Account creation, lifecycle, roles, requirement assignments, and audit logs.
- Admin reports include institution-wide financial summaries.
- Filters, deduplication, bounded queries, and safe CSV exports.

Visual: `11-admin-dashboard-overview.png`, `12-admin-user-management.png`,
`13-admin-reports.png`.

## Slide 11 - Data model and reporting flow

Talking points:

- Firestore collections and logical subcollection relationships.
- Server authorization precedes bounded report queries.
- Metrics feed UI summaries and CSV outputs.

Visual: `07-firestore-data-model.svg`, `08-reporting-data-flow.svg`.

## Slide 12 - Testing and QA

Talking points:

- Unit, emulator integration, Rules, Playwright E2E, UX/accessibility,
  responsive, keyboard, and print tests.
- Acceptance orchestration runs the layers deterministically.
- CI and Acceptance workflows validate the final pushed SHA.

Visual: `docs/UX_ACCESSIBILITY_QA.md` matrix or `15-printable-clearance-prototype.png`.

## Slide 13 - Interface evidence

Talking points:

- Corporate theme desktop screenshot library.
- Approved, pending, not-approved, and unpaid states.
- Signatory and Accountant dialogs remain usable at desktop width.

Visual: `02-student-dashboard-approved.png`, `06-signatory-review-dialog.png`,
`15-printable-clearance-prototype.png`.

## Slide 14 - Limitations and future work

Talking points:

- Capstone MVP and fictional data only.
- No official institutional certificate, electronic signature, email, or payment
  gateway.
- Bulk CSV import and expanded analytics are deferred.
- Remote Vercel deployment is a demonstration environment, not production.

Speaker notes: Do not describe limitations as failures of the implemented MVP;
state them as scope boundaries.

## Slide 15 - Conclusion and demo transition

Talking points:

- ASCS connects clearance routing, financial accountability, and oversight.
- The prototype is testable, repeatable, and auditable within its defined scope.
- Transition to the 8-12 minute demo script.

Visual: `03-vercel-firebase-deployment.svg` with the fictional-data label.
