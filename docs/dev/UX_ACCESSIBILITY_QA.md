# ASCS UX, Accessibility, Responsive QA & Defense Polish

## 1. Executive QA Matrix

The ASCS MVP was reviewed against applicable WCAG 2.2 AA accessibility criteria, responsive viewport constraints, keyboard operation standards, and theme consistency requirements using automated Playwright/axe-core testing. Manual desktop and mobile evidence is reported separately below and is only marked when recorded.

| Route / Flow | Primary-State Axe | Representative Four-Theme Axe | Responsive Evidence | Keyboard/Dialog Evidence | Final Result |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Login (`/login`) | Pass | Pass | Pass (six viewports) | Pass (keyboard login) | **PASS** |
| Change Password (`/change-password`) | Pass | Not in matrix | Not recorded | Not recorded | **PASS** |
| Student Dashboard (`/student/dashboard`) | Pass | Pass | Pass (six viewports) | Not recorded | **PASS** |
| Signatory Dashboard and Review dialog | Pass | Pass | Pass (six viewports and 320px dialog) | Pass (focus wrap and restoration) | **PASS** |
| Accountant Dashboard and Update dialog | Pass | Pass | Pass (six viewports) | Pass (containment and restoration) | **PASS** |
| Dean Dashboard (`/dean/dashboard`) | Pass | Not in matrix | Pass (six viewports) | Not recorded | **PASS** |
| Dean Reports (`/dean/reports`) | Pass | Pass | Pass (six viewports) | Not applicable | **PASS** |
| Admin Dashboard (`/admin/dashboard`) | Pass | Not in matrix | Pass (six viewports) | Pass (containment and restoration) | **PASS** |
| Admin Reports (`/admin/reports`) | Pass | Pass | Pass (six viewports) | Not applicable | **PASS** |
| Printable Clearance (`/student/clearance/[id]/print`) | Pass | Not in matrix | Not recorded | Not applicable | **PASS** |

---

## 2. Engineering QA Target & Standards

> **Compliance Disclaimer**: The documented matrix below is based on automated Playwright/axe-core checks and targeted keyboard/responsive browser tests. Manual desktop and mobile evidence was not recorded for this verification pass. This capstone prototype does not claim formal third-party accessibility certification or official institutional deployment.

### Key Accessibility & UX Enhancements Implemented
1. **Authenticated Header Navigation (`RoleHeader`)**:
   - **Desktop (`md` and above)**: Exposes `ASCS PKM | NavLinks | NotificationDropdown | ThemeSelector | Logout`.
   - **Mobile (`<768px`)**: Top bar renders `ASCS PKM | NotificationDropdown | Menu toggle`. Collapsible mobile menu exposes navigation links, `ThemeSelector`, and `Logout` without duplicate controls.
2. **Global Skip Link**: High-contrast `SkipLink` component (`<a href="#main-content">Skip to main content</a>`) present on all authenticated headers to allow keyboard users to bypass top navigation.
3. **Page Landmarks**: All core screens structured with `<header>`, `<nav>`, `<main id="main-content">`, `<section>`, and logical heading hierarchies (`<h1>` -> `<h2>` -> `<h3>`).
4. **Accessible Dialogs (`AccessibleDialog`)**: Custom modals use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`. Keyboard focus moves automatically into the dialog on open, traps focus with `Tab` / `Shift+Tab`, closes safely on `Escape`, and restores focus to the triggering element upon close.
5. **Form Accessibility**: Inputs include `autocomplete` attributes (`username`, `current-password`, `new-password`), `aria-invalid`, and `aria-describedby` linked to validation error paragraphs. Form submit buttons display clear loading state text (`"Signing in..."`, `"Submitting Application..."`) and `aria-busy="true"`.
6. **Theme Consistency**: Dark-only hardcoded classes (`bg-slate-950`, `text-slate-400`) replaced with DaisyUI semantic tokens (`bg-base-100`, `bg-base-200`, `bg-base-300`, `text-base-content`, `text-base-content/70`, `text-primary`, `border-base-content/10`) ensuring high contrast and legibility across themes. The production selector exposes only `ASCS Light` and `ASCS Dark`; legacy `corporate` and `night` aliases remain supported for saved links and cookies.
7. **Focus Visibility**: Universal `:focus-visible` ring indicators applied across all themes with crisp contrast.
8. **Reduced Motion**: Respects `@media (prefers-reduced-motion: reduce)` by disabling non-essential CSS transitions, pulse animations, and scale effects.
9. **Print Layout**: Dedicated print media styles (`@media print`) format the clearance certificate for A4 paper output, hiding web toolbars, buttons, and navigation headers.

---

## 3. Multi-Theme Contrast QA Evidence

| Theme | Automated Contrast | Manual Desktop (1440x900) | Manual Mobile (375x667) | Final Result |
| :--- | :---: | :---: | :---: | :---: |
| **ASCS Dark** | Pass (0 Critical/Serious) | Not recorded | Not recorded | **PASS** |
| **ASCS Light** | Pass (0 Critical/Serious) | Not recorded | Not recorded | **PASS** |
| **Corporate alias** | Pass (0 Critical/Serious) | Not recorded | Not recorded | **PASS** |
| **Night alias** | Pass (0 Critical/Serious) | Not recorded | Not recorded | **PASS** |

**Evidence boundaries:** "Representative automated" means that Login, Student Dashboard, Signatory Dashboard plus its open Review dialog, Accountant Dashboard plus its open Update dialog, Admin Reports, and Dean Reports are each scanned under the two production themes and their two legacy aliases. It does not mean that every route and every dialog was scanned under every theme. The manual desktop and mobile columns are marked "Not recorded" for this automated verification pass.

---

## 4. Automated UX & Accessibility Test Suite

The UX test suite can be executed independently via:

```bash
npm run test:ux
```

This suite executes 4 dedicated Playwright test files:
1. `tests/e2e/accessibility.spec.ts`: Automated `@axe-core/playwright` WCAG 2.2 AA scans cover the major routes in their primary state and add a representative six-screen matrix under the two production themes (`ascs-light`, `ascs-dark`) plus legacy aliases (`corporate`, `night`). Color-contrast and document-title rules remain enabled; assertions fail on critical or serious violations.
2. `tests/e2e/responsive-layout.spec.ts`: Audits 6 viewports (`320x568`, `375x667`, `430x932`, `768x1024`, `1280x720`, `1440x900`), verifies zero page-level horizontal overflow (`scrollWidth <= clientWidth`), and opens the Signatory Review dialog at 320px to verify its bounds, scrollable body, and reachable actions.
3. `tests/e2e/keyboard-navigation.spec.ts`: Verifies keyboard form completion, `RoleHeader` desktop and mobile navigation, full Signatory modal focus trapping (first/last Tab wrapping, `Shift+Tab` wrapping, `Escape` close, focus restoration), Accountant/Admin dialog containment and restoration, keyboard `ThemeSelector` activation, and `NotificationDropdown` trigger/open/close/focus restoration. The deterministic Admin fixture has no unread notification, so unread-item activation is documented as component-semantics/manual evidence rather than fabricated in the browser test.
4. `tests/e2e/print-clearance.spec.ts`: Validates printable certificate render, student data matrix, non-official prototype disclaimer text, and toolbar exclusion under print media.

---

## 5. Defense Presentation Checklist

Before conducting a live capstone defense or demonstration:

- [ ] Ensure Firebase Auth and Firestore emulators are active.
- [ ] Run `npm run demo:reset` to seed deterministic fixture data.
- [ ] Set browser zoom level to 100% on standard desktop resolution (1440x900 or 1920x1080).
- [ ] Open `http://localhost:3000/login`.
- [ ] Verify Demo Environment Banner (`Demo Environment - Fictional Data`) is visible.
- [ ] Use `student.g@example.test` for the live 9-step multi-role clearance workflow.
- [ ] Use `student.a@example.test` for pre-cleared certificate print demonstration fallback.
- [ ] Select presentation theme (`ASCS Light` or `ASCS Dark`) via theme selector.
