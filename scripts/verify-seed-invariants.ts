import { getAdminAuth, getAdminFirestore } from '../lib/firebase/admin';
import { assertEmulatorEnvironment } from './emulator-safety';
import {
  DEMO_STAFF_FIXTURES,
  DEMO_STUDENT_FIXTURES,
  DEMO_REQUIREMENTS_FIXTURE,
} from '../tests/fixtures/demo-data';
import { isAcademicProgramCode } from '../lib/academic-programs';

export async function verifySeedInvariants(): Promise<boolean> {
  assertEmulatorEnvironment();

  const auth = getAdminAuth();
  const firestore = getAdminFirestore();

  console.log('🔍 Verifying seed invariants...');

  // 1. Check all required staff users
  for (const staff of DEMO_STAFF_FIXTURES) {
    const authUser = await auth.getUser(staff.uid).catch(() => null);
    if (!authUser) {
      throw new Error(`INVARIANT FAILED: Auth user missing for staff UID ${staff.uid}`);
    }

    const userDoc = await firestore.collection('users').doc(staff.uid).get();
    if (!userDoc.exists) {
      throw new Error(`INVARIANT FAILED: Firestore users doc missing for staff UID ${staff.uid}`);
    }

    const userData = userDoc.data();
    if (userData?.role !== staff.role) {
      throw new Error(`INVARIANT FAILED: Staff role mismatch for ${staff.uid}. Expected ${staff.role}, got ${userData?.role}`);
    }

    const publicDoc = await firestore.collection('publicUsers').doc(staff.uid).get();
    if (!publicDoc.exists) {
      throw new Error(`INVARIANT FAILED: publicUsers doc missing for staff UID ${staff.uid}`);
    }
  }

  // 2. Check all student users
  for (const student of DEMO_STUDENT_FIXTURES) {
    const authUser = await auth.getUser(student.uid).catch(() => null);
    if (!authUser) {
      throw new Error(`INVARIANT FAILED: Auth user missing for student UID ${student.uid}`);
    }

    if (student.accountStatus === 'inactive' && !authUser.disabled) {
      throw new Error(`INVARIANT FAILED: Inactive student UID ${student.uid} must be disabled in Auth`);
    }

    const userDoc = await firestore.collection('users').doc(student.uid).get();
    if (!userDoc.exists) {
      throw new Error(`INVARIANT FAILED: Firestore users doc missing for student UID ${student.uid}`);
    }

    const userData = userDoc.data();
    if (userData?.mustChangePassword !== (student.mustChangePassword === true)) {
      throw new Error(
        `INVARIANT FAILED: mustChangePassword mismatch for ${student.uid}. Expected ${student.mustChangePassword}, got ${userData?.mustChangePassword}`
      );
    }

    const studentDoc = await firestore.collection('students').doc(student.uid).get();
    if (!studentDoc.exists) {
      throw new Error(`INVARIANT FAILED: Firestore students doc missing for student UID ${student.uid}`);
    }
    const studentData = studentDoc.data();
    if (!student.program || studentData?.program !== student.program || !isAcademicProgramCode(studentData?.program)) {
      throw new Error(
        `INVARIANT FAILED: Program mismatch for ${student.uid}. Expected ${student.program}, got ${studentData?.program}`
      );
    }
  }

  // 3. Check clearance requirements
  const activeRequirementRoles: string[] = [];
  for (const req of DEMO_REQUIREMENTS_FIXTURE) {
    const reqDoc = await firestore.collection('clearanceRequirements').doc(req.id).get();
    if (!reqDoc.exists) {
      throw new Error(`INVARIANT FAILED: Clearance requirement missing for ${req.id}`);
    }
    if (reqDoc.data()?.isActive !== false) activeRequirementRoles.push(String(reqDoc.data()?.role));
  }
  const expectedActiveRoles = ['librarian', 'osa_coordinator', 'guidance_counselor', 'area_chair', 'dean'];
  if (activeRequirementRoles.sort().join('|') !== expectedActiveRoles.sort().join('|')) {
    throw new Error(`INVARIANT FAILED: Active requirement roles must be exactly ${expectedActiveRoles.join(', ')}.`);
  }

  // 4. Verify Student A (Fully Approved)
  const appA = await firestore.collection('clearanceApplications').doc('app-student-a').get();
  if (!appA.exists) {
    throw new Error('INVARIANT FAILED: Application for Student A missing.');
  }
  const appAData = appA.data();
  if (
    appAData?.overallStatus !== 'approved' ||
    appAData?.financialStatus !== 'paid' ||
    appAData?.printableAvailable !== true ||
    appAData?.program !== 'BSAIS'
  ) {
    throw new Error(`INVARIANT FAILED: Student A state incorrect. Got: ${JSON.stringify(appAData)}`);
  }
  if (typeof appAData?.deanApproved !== 'boolean') {
    throw new Error('INVARIANT FAILED: Student A must contain deanApproved.');
  }
  const appAApprovals = await appA.ref.collection('approvals').get();
  const appARoles = appAApprovals.docs.map((doc) => doc.data().signatoryRole);
  if (appAApprovals.size !== 5 || appARoles.includes('adviser') || !appARoles.includes('dean')) {
    throw new Error('INVARIANT FAILED: Student A approval rows must contain the five active roles and no Adviser row.');
  }

  // 5. Verify Student B (Pending)
  const appB = await firestore.collection('clearanceApplications').doc('app-student-b').get();
  if (!appB.exists) {
    throw new Error('INVARIANT FAILED: Application for Student B missing.');
  }
  const appBData = appB.data();
  if (appBData?.overallStatus !== 'pending' || appBData?.printableAvailable !== false || appBData?.program !== 'BSMA') {
    throw new Error(`INVARIANT FAILED: Student B state incorrect. Got: ${JSON.stringify(appBData)}`);
  }

  // 6. Verify Student C (Not Approved)
  const appC = await firestore.collection('clearanceApplications').doc('app-student-c').get();
  if (!appC.exists) {
    throw new Error('INVARIANT FAILED: Application for Student C missing.');
  }
  const appCData = appC.data();
  if (appCData?.overallStatus !== 'not_approved' || appCData?.printableAvailable !== false || appCData?.program !== 'BEED') {
    throw new Error(`INVARIANT FAILED: Student C state incorrect. Got: ${JSON.stringify(appCData)}`);
  }

  // 7. Verify Student D (Unpaid Hold)
  const appD = await firestore.collection('clearanceApplications').doc('app-student-d').get();
  if (!appD.exists) {
    throw new Error('INVARIANT FAILED: Application for Student D missing.');
  }
  const appDData = appD.data();
  if (
    appDData?.financialStatus !== 'unpaid' ||
    appDData?.overallStatus !== 'not_approved' ||
    appDData?.printableAvailable !== false ||
    appDData?.program !== 'CRIM'
  ) {
    throw new Error(`INVARIANT FAILED: Student D state incorrect. Got: ${JSON.stringify(appDData)}`);
  }

  // 8. Verify Student E (Temporary Password)
  const userE = await firestore.collection('users').doc('demo-student-e-uid').get();
  if (userE.data()?.mustChangePassword !== true || userE.data()?.accountStatus !== 'active') {
    throw new Error('INVARIANT FAILED: Student E mustChangePassword or accountStatus incorrect.');
  }

  const authUserE = await auth.getUser('demo-student-e-uid');
  if (authUserE.customClaims?.mustChangePassword !== true) {
    throw new Error('INVARIANT FAILED: Student E Auth custom claims must include mustChangePassword: true.');
  }

  // 9. Verify Student F (Inactive)
  const userF = await firestore.collection('users').doc('demo-student-f-uid').get();
  if (userF.data()?.accountStatus !== 'inactive' || userF.data()?.isActive === true) {
    throw new Error('INVARIANT FAILED: Student F accountStatus must be inactive.');
  }

  console.log('✅ All seed invariants verified successfully.');
  return true;
}

if (require.main === module) {
  verifySeedInvariants()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Invariant verification failed:', err);
      process.exit(1);
    });
}
