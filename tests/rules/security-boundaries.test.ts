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

    // Seed mock user doc for rule functions like getUserData()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/student-a-uid'), { role: 'student' });
      await setDoc(doc(db, 'users/student-b-uid'), { role: 'student' });
      await setDoc(doc(db, 'users/admin-uid'), { role: 'admin' });
      await setDoc(doc(db, 'users/librarian-uid'), { role: 'librarian' });
      await setDoc(doc(db, 'clearanceApplications/app-student-a'), {
        studentUid: 'student-a-uid',
        financialStatus: 'paid',
      });
      await setDoc(doc(db, 'clearanceApplications/app-student-b'), {
        studentUid: 'student-b-uid',
        financialStatus: 'pending',
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

  it('3. Student CANNOT write user docs, student docs, applications, or approval rows', async () => {
    const studentDb = testEnv.authenticatedContext('student-a-uid').firestore();

    await assertFails(setDoc(doc(studentDb, 'users/student-a-uid'), { role: 'admin' }));
    await assertFails(setDoc(doc(studentDb, 'students/student-a-uid'), { fullName: 'Hacked' }));
    await assertFails(
      setDoc(doc(studentDb, 'clearanceApplications/app-student-a/approvals/librarian'), {
        status: 'approved',
      })
    );
  });

  it('4. Unauthenticated requests are denied read/write on private resources', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(anonDb, 'users/student-a-uid')));
    await assertFails(getDoc(doc(anonDb, 'clearanceApplications/app-student-a')));
  });

  it('5. All client writes to users, publicUsers, and clearanceApplications are denied (Server-Only)', async () => {
    const adminDb = testEnv.authenticatedContext('admin-uid').firestore();

    // Even Admin client writes are denied because writes are server-only via Admin SDK in current architecture
    await assertFails(setDoc(doc(adminDb, 'users/new-user'), { role: 'student' }));
    await assertFails(
      updateDoc(doc(adminDb, 'clearanceApplications/app-student-a'), { financialStatus: 'unpaid' })
    );
  });
});
