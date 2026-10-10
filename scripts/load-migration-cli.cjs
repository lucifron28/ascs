// The migration is a standalone Node process, not a Next client/server
// component.  `lib/firebase/admin.ts` is still protected by `server-only`
// when imported by the application; this CLI-only preload neutralizes that
// marker without loading `.env.local`, whose emulator settings must never be
// inherited by a remote migration.
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
};
