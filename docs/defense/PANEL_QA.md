# ASCS Panel Questions and Defensible Answers

The answers below deliberately describe the implemented MVP without claiming
institutional deployment or certification.

## Problem and scope

1. **What problem does ASCS solve?** It centralizes clearance submission,
   role-scoped sign-offs, financial accountability status, student visibility,
   and reports that are otherwise fragmented across paper routing and office
   follow-ups.
2. **Why is this a capstone MVP?** It demonstrates the core workflow and its
   controls within a bounded academic project; production operations, official
   certificates, payments, email, and electronic signatures are out of scope.
3. **Who are the users?** Students, five clearance signatory roles, an
   Accountant, an Academic Dean, and a System Administrator.
4. **Why is Bulk CSV Account Import deferred?** Single-account creation and
   lifecycle safeguards are implemented first. Bulk import needs parser,
   validation, preview, rollback, and operational audit design.
5. **Does the system use real student data?** No. Fixtures use fictional
   `@example.test` identities.

## Architecture and technology

6. **Why Next.js?** The App Router provides a clear boundary between browser
   UI and server actions that verify sessions and perform trusted Firebase work.
7. **Why React and TypeScript?** React supports componentized role UI;
   TypeScript makes roles, statuses, records, and action payloads explicit.
8. **Why Firebase?** It supplies managed email/password identity, Firestore,
   Admin SDK, emulators, and Rules testing suitable for this prototype.
9. **Why Firestore instead of a relational database?** Applications and their
   approval/remark subcollections are document-oriented. The design uses
   logical references and server validation rather than relational foreign keys.
10. **Why Vercel?** It is a convenient Next.js demonstration host. The Vercel
    environment is fictional-data demo infrastructure, not official PKM
    production infrastructure.
11. **Why Server Actions?** They keep session verification and privileged writes
    on the server while exposing typed workflow operations to the UI.
12. **What is the trusted boundary?** Server-side session/profile/role checks
    plus Firebase Admin SDK are the application trust boundary; Firestore Rules
    are the direct client SDK boundary.

## Authentication, sessions, and RBAC

13. **Where is the session stored?** In an HTTP-only cookie configured by
    `SESSION_COOKIE_NAME`, not browser `localStorage`.
14. **How is a request authorized?** The server verifies the cookie, loads
    `users/{uid}`, checks active and password-transition state, then checks role
    and requested scope.
15. **What happens when a user is deactivated?** Auth sign-in is disabled,
    active sessions are revoked where applicable, and server authorization
    rejects the inactive profile.
16. **What happens for a temporary password?** `mustChangePassword` blocks
    normal actions until the server-verified password-change flow completes.
17. **Can a student read another student's application?** Firestore Rules and
    server actions deny cross-student access.
18. **Can the browser write an approval or financial status directly?** No.
    Rules deny workflow writes; authorized Server Actions perform them.
19. **Why keep role data in Firestore if Auth has claims?** Firestore stores the
    authoritative profile and lifecycle flags; Auth claims are synchronized for
    identity/routing support.

## Clearance and financial accountability

20. **Why is the Accountant not a signatory?** The Accountant verifies a
    clearance-level financial state. A duplicate approval row would mix financial
    accountability with office sign-off semantics.
21. **What does unpaid do?** `unpaid` requires a remark, derives overall
    `not_approved` when signatories are complete, and blocks print availability.
22. **What if one signatory rejects?** Any required `not_approved` row wins and
    its remark is visible to the student.
23. **What if approvals are still pending?** Overall status remains `pending`
    and the print record is unavailable.
24. **When is a record printable?** When all five required signatories are
    approved and the financial state is `paid`, producing overall `approved`.
    The output is an A4 PKM-slip-inspired digital prototype with a separate
    `FINANCIAL ACCOUNTABILITY REVIEW`; it contains no reproduced signatures and
    is not an official certificate.
25. **Why does Adviser approval affect the Dean?** It is the academic handoff
    gate: `adviserApproved` filters Dean queues and reports without making the
    Dean another required signatory.
26. **How are duplicate applications prevented?** Submission uses a
    deterministic student/academic-year/semester identity and rejects an
    existing application for the same term.
27. **How are remarks enforced?** Server actions require non-empty remarks for
    `pending` and `not_approved` decisions and preserve remark history.
27a. **Why does the digital record differ from the paper clearance slip?** The
     paper slip informed the information hierarchy and office checklist. ASCS
     converts that structure into machine-readable workflow fields so a student
     can see status, assigned signatory, remarks, and review dates without
     pretending that a digital prototype is the institution's handwritten form.
27b. **Which paper-slip elements were retained?** The record retains the
     institution header, clearance title, academic term, student identity block,
     office checklist, remarks/date areas, and explanatory note. No personal
     details or handwritten signatures from the reference paper were copied.
27c. **Why is there no reproduced signature column?** The MVP records each
     signatory's decision and actor name in the audit trail. It does not create a
     fake handwritten or electronic signature, and the printed page is labelled
     a nonofficial prototype record.
27d. **Where are Accountant and Dean responsibilities shown?** Accountant
     verification appears in the separate Financial Accountability Review. Dean
     access is an Adviser-approved oversight path, so Dean is not one of the five
     required signatory rows.

## Reports and data integrity

28. **What is different about Admin and Dean reports?** Admin reports are
    institution-wide and include financial summaries. Dean reports are limited
    to Adviser-approved applications and exclude financial summaries/details.
29. **How do you prevent corrupted records from silently changing totals?**
    Status allowlists, duplicate-ID contradiction checks, bounded queries, and
    explicit integrity errors protect metrics.
30. **How are academic terms handled?** Canonical values are `1st Semester`,
    `2nd Semester`, and `Summer Semester`; legacy short aliases remain readable.
31. **How are CSV exports secured?** Scope authorization selects columns, Dean
    exports omit financial fields, and formula-leading cells are neutralized.
32. **What happens beyond 5,000 applications?** The report limit guard rejects
    the request and requires narrower filters instead of returning incomplete
    metrics.

## Testing, accessibility, and resilience

33. **How was the system tested?** Unit, emulator integration, client Rules,
    Playwright browser, axe accessibility, responsive, keyboard, dialog, print,
    and acceptance orchestration tests were run.
34. **Why use emulators?** They provide deterministic fictional data, isolate
    tests from external services, and make reset/seed behavior repeatable.
35. **What accessibility evidence exists?** Primary route axe scans, a
    four-theme representative matrix, keyboard ThemeSelector/dialog checks,
    notification trigger checks, responsive viewports, and print checks.
36. **Is ASCS WCAG certified?** No. Automated checks support prototype QA but
    do not constitute third-party certification.
37. **What happens if Firebase is unavailable?** Authentication and persisted
    workflow operations cannot complete; the defense uses emulator fallback and
    deterministic screenshots.
38. **How are seed/reset scripts kept safe?** They require emulator hosts, the
    emulator switch, and a non-production project ID before destructive reset.
39. **How are notifications implemented?** Server actions write recipient-
    scoped Firestore documents; the UI reads and marks them through authorized
    actions. Email delivery is deferred.
40. **What would you improve next?** Bulk import with rollback, email delivery,
    payment integration, electronic signatures, richer analytics, monitoring,
    and a formal institutional deployment review.
