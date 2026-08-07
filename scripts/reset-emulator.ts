import { assertEmulatorEnvironment } from './emulator-safety';
import { seedEmulator } from './seed-emulator';

export async function resetEmulator(): Promise<void> {
  const env = assertEmulatorEnvironment();

  console.log(`🧹 Resetting Firebase Emulator Suite for project "${env.projectId}"...`);

  // 1. Clear Auth Emulator Accounts
  const authUrl = `http://${env.authHost}/emulator/v1/projects/${env.projectId}/accounts`;
  console.log(`Clearing Auth emulator data via ${authUrl}...`);
  const authRes = await fetch(authUrl, { method: 'DELETE' });
  if (!authRes.ok) {
    throw new Error(`Failed to clear Auth emulator accounts: HTTP ${authRes.status}`);
  }

  // 2. Clear Firestore Emulator Data
  const firestoreUrl = `http://${env.firestoreHost}/emulator/v1/projects/${env.projectId}/databases/(default)/documents`;
  console.log(`Clearing Firestore emulator data via ${firestoreUrl}...`);
  const firestoreRes = await fetch(firestoreUrl, { method: 'DELETE' });
  if (!firestoreRes.ok) {
    throw new Error(`Failed to clear Firestore emulator data: HTTP ${firestoreRes.status}`);
  }

  console.log('✅ Emulator data cleared. Re-seeding deterministic fixtures...');

  // 3. Re-seed
  await seedEmulator();
  console.log('✨ Emulator reset and re-seeding complete.');
}

if (require.main === module) {
  resetEmulator()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Reset emulator failed:', err);
      process.exit(1);
    });
}
