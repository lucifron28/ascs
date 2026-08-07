// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS preload required before ESM imports load server-only
require('../tests/helpers/mock-server-only.cjs');

export default async function demoPrepare() {
  const { setupTestEnvironment } = await import('../tests/helpers/test-auth');
  const { resetEmulator } = await import('./reset-emulator');
  const { DEMO_STAFF_FIXTURES, DEMO_STUDENT_FIXTURES, DEMO_APPLICATION_FIXTURES } = await import(
    '../tests/fixtures/demo-data'
  );

  setupTestEnvironment();

  console.log('🎬 Preparing ASCS defense/demo environment...');
  console.log('──────────────────────────────────────────────────────────────');

  // 1-4. Reset emulator data, seed fixtures, verify invariants
  await resetEmulator();

  console.log('');
  console.log('🎭 EMULATOR / DEMO ONLY — Fictional accounts');
  console.log('──────────────────────────────────────────────────────────────');
  console.log('All credentials below exist ONLY in the local Firebase Emulator');
  console.log('Suite and are intentionally test-only. Never use them anywhere else.');
  console.log('');
  console.log('Staff accounts:');
  for (const user of DEMO_STAFF_FIXTURES) {
    console.log(`  • ${user.role.padEnd(16)} ${user.email.padEnd(28)} password: ${user.password}`);
  }
  console.log('');
  console.log('Student accounts:');
  for (const user of DEMO_STUDENT_FIXTURES) {
    const scenario = user.uid.replace('demo-student-', '').replace('-uid', '');
    console.log(`  • student ${scenario.padEnd(2)} ${user.email.padEnd(28)} password: ${user.password}`);
  }

  console.log('');
  console.log('📊 Seeded scenario summary');
  console.log('──────────────────────────────────────────────────────────────');
  for (const app of DEMO_APPLICATION_FIXTURES) {
    console.log(
      `  • ${app.id.padEnd(16)} status=${app.overallStatus.padEnd(12)} financial=${app.financialStatus.padEnd(7)} ` +
        `printable=${app.printableAvailable}`
    );
  }
  console.log('  • Student E (temp pass)   mustChangePassword=true, accountStatus=active');
  console.log('  • Student F (inactive)    accountStatus=inactive, Auth disabled');

  console.log('');
  console.log('✅ Defense environment ready. Start the app with: npm run dev');
  console.log('   Emulators must already be running (npm run emulators).');
}

if (require.main === module) {
  demoPrepare()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ demo:prepare failed:', err);
      process.exit(1);
    });
}
