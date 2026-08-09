# ASCS Defense Checklist

## Day before

- [ ] Run `npm ci`, `npm test`, `npm run lint`, `npm run build`.
- [ ] Run `npm run test:integration`, `npm run test:ux`, `npm run test:e2e`, and
      `npm run test:acceptance` with the emulator environment.
- [ ] Verify the final CI and Acceptance runs for the pushed SHA.
- [ ] Run `npm run docs:diagrams` and `npm run verify:docs`.
- [ ] Reset the local emulator and rehearse the demo script.
- [ ] Check the verified Vercel demo URL, if one is recorded in
      `docs/VERCEL_DEPLOYMENT.md`.
- [ ] Verify all diagrams and desktop screenshots open correctly.
- [ ] Confirm projector/monitor resolution and browser zoom plan.

## 30 minutes before

- [ ] Confirm internet connectivity and the local fallback.
- [ ] Open the Vercel demo URL only if its deployment record is verified.
- [ ] Confirm local Auth (`9099`) and Firestore (`8080`) emulators are running
      for the fallback.
- [ ] Run `npm run demo:reset`.
- [ ] Verify `admin@example.test`, `student.a@example.test`, and
      `student.g@example.test` in the local fixture.
- [ ] Open the presentation deck and keep the Corporate theme selected.
- [ ] Set browser zoom to 100% and viewport to a desktop size.
- [ ] Keep the screenshot library and diagrams available offline.

## During the defense

- [ ] State that ASCS is a capstone prototype/MVP.
- [ ] State that demo records are fictional.
- [ ] State that Vercel, if used, is a demonstration deployment, not official
      institutional production infrastructure.
- [ ] Explain Accountant financial gate and Adviser-to-Dean visibility.
- [ ] Do not use real student data.
- [ ] Do not expose passwords, private keys, tokens, service accounts, or
      Firebase console credentials.
- [ ] If the network fails, switch to local emulators or screenshots.
- [ ] Do not change Firebase configuration live.
