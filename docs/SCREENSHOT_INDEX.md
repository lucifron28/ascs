# ASCS Desktop Screenshot Index

Canonical screenshots are captured locally from the Firebase Emulator Suite
with deterministic fictional fixtures, a 1440x900 desktop viewport, device
scale factor 1, browser zoom 100%, and the Corporate theme. They are interface
evidence for the manuscript and defense, not production monitoring evidence.

| File | Route | Role | Scenario | Manuscript use | Defense slide use |
| --- | --- | --- | --- | --- | --- |
| `01-login.png` | `/login` | Public | Fictional sign-in | Interface / authentication | Title or security |
| `02-student-dashboard-approved.png` | `/student/dashboard` | Student | Student A approved + paid | Results / workflow | Student workflow |
| `03-student-dashboard-pending.png` | `/student/dashboard` | Student | Student B pending | Results / status derivation | Pending state |
| `04-student-submit-clearance.png` | `/student/dashboard` | Student | Student G no application | Functional interface | Submission step |
| `05-signatory-dashboard.png` | `/guidance_counselor/dashboard` | Guidance Counselor | Pending evaluation queue | Signatory workflow | Signatory workflow |
| `06-signatory-review-dialog.png` | `/guidance_counselor/dashboard` | Guidance Counselor | Review dialog open | Dialog evidence | Signatory dialog |
| `07-accountant-dashboard.png` | `/accountant/dashboard` | Accountant | Financial queue | Financial accountability | Accountant workflow |
| `08-accountant-financial-dialog.png` | `/accountant/dashboard` | Accountant | Update dialog open | Financial gate | Accountant dialog |
| `09-adviser-dashboard.png` | `/adviser/dashboard` | Adviser | Adviser queue | Dean visibility gate | Adviser oversight |
| `10-dean-dashboard.png` | `/dean/dashboard` | Dean | Adviser-approved oversight | Academic oversight | Dean oversight |
| `11-admin-dashboard-overview.png` | `/admin/dashboard` | Admin | Overview tab | Administration | Admin functions |
| `12-admin-user-management.png` | `/admin/dashboard` | Admin | Users tab | Account lifecycle | Admin functions |
| `13-admin-reports.png` | `/admin/reports` | Admin | Institution report | Reporting | Admin reports |
| `14-dean-reports.png` | `/dean/reports` | Dean | Adviser-approved report | Reporting privacy | Dean reports |
| `15-printable-clearance-prototype.png` | `/student/clearance/app-student-a/print` | Student | Approved prototype record | Output | Printable output |
| `16-not-approved-student-view.png` | `/student/dashboard` | Student | Student C remark / rejection | Status and limitations | Not-approved state |

Reproduce with:

```bash
npm run emulators
npm run demo:reset
DOC_SCREENSHOT_BASE_URL=http://127.0.0.1:3000 npm run docs:screenshots
npm run verify:docs
```

On PowerShell, set `DOC_SCREENSHOT_BASE_URL` as an environment variable before
running the command. Use a production `next start` server for evidence capture
(`next dev` adds development UI and is not a clean thesis figure source). The
screenshot script does not use Vercel or real data.
