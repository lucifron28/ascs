import { describe, it, before, after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

describe('Firestore Rules Security Boundaries Tests', () => {
  let testEnv: RulesTestEnvironment;

  before(async () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'ascs11',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules,
      },
    });

    // Seed mock user docs for rule helper functions like getUserData()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/student-a-uid'), { role: 'student', accountStatus: 'active', isActive: true });
      await setDoc(doc(db, 'users/student-b-uid'), { role: 'student', accountStatus: 'active', isActive: true });
      await setDoc(doc(db, 'users/admin-uid'), { role: 'admin', accountStatus: 'active', isActive: true });
      await setDoc(doc(db, 'users/librarian-uid'), { role: 'librarian', accountStatus: 'active', isActive: true });
      await setDoc(doc(db, 'users/accountant-uid'), { role: 'accountant', accountStatus: 'active', isActive: true });
      await setDoc(doc(db, 'users/dean-uid'), { role: 'dean', accountStatus: 'active', isActive: true });
      await setDoc(doc(db, 'users/pending-student-uid'), { role: 'student', accountStatus: 'pending_approval', isActive: false });
      await setDoc(doc(db, 'users/inactive-admin-uid'), { role: 'admin', accountStatus: 'inactive', isActive: false });
      await setDoc(doc(db, 'activityLogs/log-1'), { action: 'test_action' });
      await setDoc(doc(db, 'clearanceApplications/app-student-a'), {
        studentUid: 'student-a-uid',
        financialStatus: 'paid',
      });
      await setDoc(doc(db, 'clearanceApplications/app-student-b'), {
        studentUid: 'student-b-uid',
        financialStatus: 'pending',
      });
      await setDoc(doc(db, 'clearanceApplications/app-student-a/approvals/librarian'), {
        signatoryRole: 'librarian',
        status: 'pending',
      });
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('1. Student can read own profile & application', async () => {
    const studentDb = testEnv.authenticatedContext('student-a-uid').firestore();

    await assertSucceeds(getDoc(doc(studentDb, 'users/student-a-uid')));
    await assertSucceeds(getDoc(doc(studentDb, 'clearanceApplications/app-student-a')));
  });

  it('2. Student CANNOT read another student private profile or application', async () => {
    const studentDb = testEnv.authenticatedContext('student-a-uid').firestore();

    await assertFails(getDoc(doc(studentDb, 'users/student-b-uid')));
    await assertFails(getDoc(doc(studentDb, 'clearanceApplications/app-student-b')));
  });

  it('3. Student client SDK explicitly fails writing financialStatus, approval status, or another application', async () => {
    const studentDb = testEnv.authenticatedContext('student-a-uid').firestore();

    // Cannot write financialStatus
    await assertFails(
      updateDoc(doc(studentDb, 'clearanceApplications/app-student-a'), { financialStatus: 'paid' })
    );

    // Cannot write approval status
    await assertFails(
      updateDoc(doc(studentDb, 'clearanceApplications/app-student-a/approvals/librarian'), {
        status: 'approved',
      })
    );

    // Cannot create or modify another student application
    await assertFails(
      setDoc(doc(studentDb, 'clearanceApplications/app-student-b'), { studentUid: 'student-a-uid' })
    );
  });

  it('4. Unauthenticated requests are denied read/write on private resources', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(anonDb, 'users/student-a-uid')));
    await assertFails(getDoc(doc(anonDb, 'clearanceApplications/app-student-a')));
  });

  it('5. Staff client SDK writes (Librarian, Accountant, Dean, Admin) are denied (Server-Only architecture)', async () => {
    const librarianDb = testEnv.authenticatedContext('librarian-uid').firestore();
    const accountantDb = testEnv.authenticatedContext('accountant-uid').firestore();
    const deanDb = testEnv.authenticatedContext('dean-uid').firestore();
    const adminDb = testEnv.authenticatedContext('admin-uid').firestore();

    // Librarian cannot write approval row via client SDK
    await assertFails(
      updateDoc(doc(librarianDb, 'clearanceApplications/app-student-a/approvals/librarian'), {
        status: 'approved',
      })
    );

    // Accountant cannot write financialStatus via client SDK
    await assertFails(
      updateDoc(doc(accountantDb, 'clearanceApplications/app-student-a'), { financialStatus: 'paid' })
    );

    // Dean cannot write user docs via client SDK
    await assertFails(
      setDoc(doc(deanDb, 'users/some-user'), { role: 'student' })
    );

    // Admin cannot write user docs via client SDK (server actions + Admin SDK required)
    await assertFails(
      setDoc(doc(adminDb, 'users/new-user'), { role: 'student' })
    );
  });

  it('6. Pending students CANNOT read protected collections through client SDK', async () => {
    const pendingDb = testEnv.authenticatedContext('pending-student-uid').firestore();

    await assertFails(getDoc(doc(pendingDb, 'users/pending-student-uid')));
    await assertFails(getDoc(doc(pendingDb, 'publicUsers/student-a-uid')));
    await assertFails(getDoc(doc(pendingDb, 'clearanceRequirements/librarian')));
    await assertFails(getDoc(doc(pendingDb, 'clearanceApplications/app-student-a')));
    await assertFails(getDoc(doc(pendingDb, 'activityLogs/log-1')));
  });

  it('7. Inactive administrators CANNOT read protected collections through client SDK', async () => {
    const inactiveAdminDb = testEnv.authenticatedContext('inactive-admin-uid').firestore();

    await assertFails(getDoc(doc(inactiveAdminDb, 'users/student-a-uid')));
    await assertFails(getDoc(doc(inactiveAdminDb, 'clearanceApplications/app-student-a')));
    await assertFails(getDoc(doc(inactiveAdminDb, 'activityLogs/log-1')));
    await assertFails(getDoc(doc(inactiveAdminDb, 'registrationEmailDeliveries/delivery-1')));
  });

  it('8. Active administrators CAN read permitted admin collections', async () => {
    const activeAdminDb = testEnv.authenticatedContext('admin-uid').firestore();

    await assertSucceeds(getDoc(doc(activeAdminDb, 'users/student-a-uid')));
    await assertSucceeds(getDoc(doc(activeAdminDb, 'clearanceApplications/app-student-a')));
    await assertSucceeds(getDoc(doc(activeAdminDb, 'activityLogs/log-1')));
  });
});
