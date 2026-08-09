# ASCS Final Handoff

## Release identity

| Field | Value |
| --- | --- |
| Repository | `https://github.com/lucifron28/ascs` |
| Final branch | `main` |
| Final SHA | To be filled after the final push |
| Release tag | To be filled only if `v0.1.0-defense` is created without moving an existing tag |
| Application status | Capstone prototype / MVP; feature-frozen for defense documentation |

## What is included

- Source-aligned architecture and manuscript evidence map in `docs/TECHNICAL_ARCHITECTURE.md` and `docs/MANUSCRIPT_ALIGNMENT.md`.
- Eight self-contained PlantUML sources in `docs/diagrams/src/`, with checked SVG and PNG renders in `docs/diagrams/svg/` and `docs/diagrams/png/`.
- Sixteen deterministic 1440×900 Corporate-theme desktop screenshots in `docs/screenshots/`, captured from the local Firebase Emulator Suite with fictional accounts only.
- Defense outline, timed demo script, panel Q&A, and presentation-day checklist in `docs/defense/`.
- Reproducible documentation commands and validators in `scripts/` and `package.json`.

## Reproduce the evidence package

```bash
npm ci
npm run emulators
npm run demo:reset
npm run docs:diagrams
npm run docs:screenshots
npm run verify:docs
```

Run the screenshot command from a second terminal while the emulator-backed app is available at `http://127.0.0.1:3000`. The screenshot harness fixes the viewport to 1440×900, device scale factor to 1, and the `corporate` theme. It does not use real student records.

For the broader verification sequence, use `npm run test:acceptance`. The detailed acceptance evidence and known test prerequisites are in `docs/ACCEPTANCE_TESTING.md`.

## Defense walkthrough

Use the fictional journey beginning with Student G in `docs/defense/DEFENSE_DEMO_SCRIPT.md`. The script intentionally demonstrates submission, signatory review, accountant financial gating, adviser visibility, Dean oversight, Admin reporting, and the printable approved record. If a live step is unavailable, use the documented screenshot/diagram fallback rather than changing data in an external project.

## Deployment record

The Vercel deployment record is maintained in [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md). A deployment is considered verified only when the final pushed SHA, Vercel deployment, dedicated fictional Firebase project, and `npm run verify:vercel` smoke test are recorded together. No emulator endpoint or production secret belongs in a Vercel environment.

At handoff, the deployment fields must be one of:

1. completed with the deployment URL, deployment ID, final SHA, Firebase demo project ID, and smoke-test result; or
2. explicitly marked blocked with the exact missing authentication/project action required from the repository owner.

Current state: Vercel verification is blocked because this environment has no
authenticated Vercel CLI session/token and no dedicated fictional Firebase demo
project. The repository owner must complete those two external setup steps
before a remote URL, deployment ID, or deployed SHA can be recorded.

## Scope and limitations

- This is an MVP prototype, not a production institutional certificate issuer, electronic-signature service, or financial-receipt system.
- Firebase Emulator Suite is the deterministic evidence environment; demo credentials are not production credentials.
- Batch CSV account import, self-service profile editing, and email password delivery remain deferred.
- The printable clearance view is a print-friendly prototype; it is not a legal certificate.
- Reporting supports the documented role scopes and a maximum of 5,000 applications per report operation.

## Recovery and maintenance

- Reset local demo state with `npm run demo:reset`.
- Regenerate diagram renders with `npm run docs:diagrams`.
- Regenerate screenshots with `npm run docs:screenshots`.
- Run `npm run verify:docs` before committing documentation assets.
- Keep `tools/.cache/plantuml.jar` local and ignored; do not commit the JAR.
- Never copy `.env.local`, Firebase Admin private keys, service-account JSON, or Vercel tokens into the repository.
