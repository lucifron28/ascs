/* eslint-disable @typescript-eslint/no-require-imports -- CJS preload for tsx */
const { loadEnvConfig } = require('@next/env');

// Keep standalone emulator scripts consistent with `next dev`/`next start`.
// Shell variables still take precedence, while `.env.local` supplies the
// guarded emulator hosts for the normal local demo workflow.
loadEnvConfig(process.cwd());
