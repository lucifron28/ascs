import { getAdminAuth, getAdminFirestore } from '../lib/firebase/admin';
import { assertEmulatorEnvironment } from './emulator-safety';
import {
  DEMO_STAFF_FIXTURES,
  DEMO_STUDENT_FIXTURES,
  DEMO_REQUIREMENTS_FIXTURE,
} from '../tests/fixtures/demo-data';
import { isAcademicProgramCode } from '../lib/academic-programs';
import { CLEARANCE_WORKFLOW_STAGES } from '../lib/clearance/workflow';

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
    if (staff.role === 'dean') {
      if (userData?.fullName !== 'Dean of Business Program') {
        throw new Error(`INVARIANT FAILED: Dean fullName must be "Dean of Business Program", got "${userData?.fullName}"`);
      }
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
  const expectedActiveStages = CLEARANCE_WORKFLOW_STAGES.filter((stage) => stage.kind === 'approval');
  const expectedActiveRoles = expectedActiveStages.map((stage) => stage.role);
  const actualActiveRoles = [...activeRequirementRoles].sort();
  if (actualActiveRoles.join('|') !== [...expectedActiveRoles].sort().join('|')) {
    throw new Error(`INVARIANT FAILED: Active requirement roles must be exactly ${expectedActiveRoles.join(', ')}.`);
  }

  const orderedActiveRequirements = DEMO_REQUIREMENTS_FIXTURE
    .filter((req) => req.isActive !== false)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const expectedRequirementOrder = expectedActiveStages
    .map((stage) => `${stage.role}:${stage.stage}:${stage.label}`)
    .join('|');
  const actualRequirementOrder = orderedActiveRequirements
    .map((req) => `${req.role}:${req.displayOrder}:${req.label}`)
    .join('|');
  if (actualRequirementOrder !== expectedRequirementOrder) {
    throw new Error(`INVARIANT FAILED: Active requirements must follow the six-stage order (${expectedRequirementOrder}).`);
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
  if (
    appAApprovals.size !== expectedActiveStages.length ||
    appARoles.includes('adviser') ||
    appARoles.includes('accountant') ||
    !appARoles.includes('dean') ||
    new Set(appARoles).size !== expectedActiveStages.length ||
    !expectedActiveRoles.every((role) => appARoles.includes(role))
  ) {
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
  if (
    appCData?.overallStatus !== 'not_approved' ||
    appCData?.financialStatus !== 'pending' ||
    appCData?.approvedCount !== 0 ||
    appCData?.pendingCount !== 4 ||
    appCData?.notApprovedCount !== 1 ||
    appCData?.deanApproved !== false ||
    appCData?.printableAvailable !== false ||
    appCData?.program !== 'BEED'
  ) {
    throw new Error(`INVARIANT FAILED: Student C state incorrect. Got: ${JSON.stringify(appCData)}`);
  }
  const appCApprovals = await appC.ref.collection('approvals').get();
  const librarianApproval = appCApprovals.docs.find((d) => d.id === 'librarian')?.data();
  if (librarianApproval?.status !== 'not_approved') {
    throw new Error('INVARIANT FAILED: Student C librarian requirement must be not_approved.');
  }

  // 7. Verify Student D (Legacy / Historical Out-of-Order Fixture)
  // Tests legacy resilience where earlier gate (Accountant) is unpaid while later signatory rows were historically approved.
  // Verified as the legacy fixture without forcing it into clean sequential consistency.
  const appD = await firestore.collection('clearanceApplications').doc('app-student-d').get();
  if (!appD.exists) {
    throw new Error('INVARIANT FAILED: Application for Student D missing.');
  }
  const appDData = appD.data();
  if (
    appDData?.financialStatus !== 'unpaid' ||
    appDData?.overallStatus !== 'not_approved' ||
    appDData?.printableAvailable !== false ||
    appDData?.program !== 'CRIM' ||
    appDData?.deanApproved !== true ||
    appDData?.approvedCount !== 5 ||
    appDData?.pendingCount !== 0 ||
    appDData?.notApprovedCount !== 0
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

  // 10. Verify Student E (Stage 1 Librarian Pending Scenario)
  const appE = await firestore.collection('clearanceApplications').doc('app-student-e').get();
  if (!appE.exists) {
    throw new Error('INVARIANT FAILED: Application for Student E (Librarian pending scenario) missing.');
  }
  const appEData = appE.data();
  if (
    appEData?.overallStatus !== 'pending' ||
    appEData?.financialStatus !== 'pending' ||
    appEData?.approvedCount !== 0 ||
    appEData?.pendingCount !== 5 ||
    appEData?.notApprovedCount !== 0 ||
    appEData?.deanApproved !== false ||
    appEData?.printableAvailable !== false
  ) {
    throw new Error(`INVARIANT FAILED: Student E application state incorrect. Got: ${JSON.stringify(appEData)}`);
  }
  const appEApprovals = await appE.ref.collection('approvals').get();
  const appERoles = appEApprovals.docs.map((doc) => doc.data().signatoryRole);
  if (
    appEApprovals.size !== expectedActiveStages.length ||
    appERoles.includes('adviser') ||
    appERoles.includes('accountant') ||
    new Set(appERoles).size !== expectedActiveStages.length ||
    !expectedActiveRoles.every((role) => appERoles.includes(role))
  ) {
    throw new Error('INVARIANT FAILED: Student E approval rows must contain the five active roles and no Adviser row.');
  }
  const libE = appEApprovals.docs.find((d) => d.id === 'librarian')?.data();
  if (libE?.status !== 'pending') {
    throw new Error('INVARIANT FAILED: Student E librarian approval must be pending.');
  }

  // 11. Comprehensive Invariant: Complete Absence of Adviser Traces
  const adviserAuth = await auth.getUserByEmail('adviser@example.test').catch(() => null);
  if (adviserAuth) {
    throw new Error(`INVARIANT FAILED: Legacy adviser Auth account still exists: ${adviserAuth.uid}`);
  }

  const adviserUsersSnap = await firestore.collection('users').where('role', '==', 'adviser').get();
  if (!adviserUsersSnap.empty) {
    throw new Error(`INVARIANT FAILED: users collection contains ${adviserUsersSnap.size} doc(s) with role="adviser"`);
  }

  const adviserPublicUsersSnap = await firestore.collection('publicUsers').where('role', '==', 'adviser').get();
  if (!adviserPublicUsersSnap.empty) {
    throw new Error(`INVARIANT FAILED: publicUsers collection contains ${adviserPublicUsersSnap.size} doc(s) with role="adviser"`);
  }

  const adviserReqDoc = await firestore.collection('clearanceRequirements').doc('adviser').get();
  if (adviserReqDoc.exists) {
    throw new Error('INVARIANT FAILED: clearanceRequirements contains "adviser" doc.');
  }

  const adviserApprovalsSnap = await firestore.collectionGroup('approvals').where('signatoryRole', '==', 'adviser').get();
  if (!adviserApprovalsSnap.empty) {
    throw new Error(`INVARIANT FAILED: Found ${adviserApprovalsSnap.size} approval doc(s) with signatoryRole="adviser"`);
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
