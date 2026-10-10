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

const fs = require('fs');
const path = require('path');
const os = require('os');

// Bridge Firebase CLI login tokens to Application Default Credentials if needed
if (
  !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  (!process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY.includes('YOUR_PRIVATE_KEY') ||
    process.env.FIREBASE_PRIVATE_KEY.includes('...'))
) {
  const fbtConfigPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (fs.existsSync(fbtConfigPath)) {
    try {
      const fbt = JSON.parse(fs.readFileSync(fbtConfigPath, 'utf8'));
      if (fbt.tokens && fbt.tokens.refresh_token) {
        const appData = process.platform.startsWith('win') ? process.env.APPDATA : path.join(os.homedir(), '.config');
        if (appData) {
          const targetDir = path.join(appData, 'firebase');
          fs.mkdirSync(targetDir, { recursive: true });
          const slug = (fbt.user && fbt.user.email ? fbt.user.email : 'unknown_user').replace('@', '_').replace(/\./g, '_');
          const targetCred = path.join(targetDir, `${slug}_application_default_credentials.json`);
          const { clientId, clientSecret } = require('firebase-tools/lib/api');
          const cred = {
            client_id: clientId(),
            client_secret: clientSecret(),
            refresh_token: fbt.tokens.refresh_token,
            type: 'authorized_user',
          };
          fs.writeFileSync(targetCred, JSON.stringify(cred, null, 2), 'utf8');
          process.env.GOOGLE_APPLICATION_CREDENTIALS = targetCred;
        }
      }
    } catch {
      // ignore error
    }
  }
}
