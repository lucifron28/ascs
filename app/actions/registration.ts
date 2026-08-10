'use server';

import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import {
  logSafeAuthError,
  mapLifecycleError,
  sanitizeAuditMetadata,
  StudentRegistrationInput,
  validateStudentRegistrationInput,
} from '@/lib/admin/lifecycle-validation';

/**
 * Create a student-only account from the public registration form.
 *
 * The role and account flags are fixed here; the browser cannot choose a
 * privileged role or write any profile documents directly.
 */
export async function registerStudentAccountAction(data: Partial<StudentRegistrationInput>) {
  let createdUid: string | null = null;
  let compensationSucceeded: boolean | undefined;

  try {
    const input = validateStudentRegistrationInput(data);
    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    let existingAuthUser = false;
    try {
      await auth.getUserByEmail(input.email);
      existingAuthUser = true;
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null
        ? (error as { code?: string }).code
        : undefined;
      if (code !== 'auth/user-not-found') {
        throw error;
      }
    }

    if (existingAuthUser) {
      throw new Error('The specified email address is already registered.');
    }

    const studentNumberQuery = await firestore
      .collection('students')
      .where('studentNumber', '==', input.studentNumber)
      .get();

    if (!studentNumberQuery.empty) {
      throw new Error(`Student number '${input.studentNumber}' is already registered to another student.`);
    }

    const userRecord = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.fullName,
      emailVerified: false,
    });
    createdUid = userRecord.uid;

    try {
      await auth.setCustomUserClaims(createdUid, {
        role: 'student',
        mustChangePassword: false,
      });

      const now = new Date().toISOString();
      const batch = firestore.batch();
      const userRef = firestore.collection('users').doc(createdUid);
      batch.set(userRef, {
        uid: createdUid,
        email: input.email,
        fullName: input.fullName,
        role: 'student',
        accountStatus: 'active',
        isActive: true,
        mustChangePassword: false,
        studentNumber: input.studentNumber,
        contactNumber: input.contactNumber,
        createdAt: now,
        updatedAt: now,
        createdBy: 'self_registration',
      });

      const publicRef = firestore.collection('publicUsers').doc(createdUid);
      batch.set(publicRef, {
        uid: createdUid,
        email: input.email,
        fullName: input.fullName,
        role: 'student',
        accountStatus: 'active',
        isActive: true,
      });

      const studentRef = firestore.collection('students').doc(createdUid);
      batch.set(studentRef, {
        uid: createdUid,
        studentNumber: input.studentNumber,
        fullName: input.fullName,
        email: input.email,
        program: input.program,
        yearLevel: input.yearLevel,
        section: input.section,
        contactNumber: input.contactNumber,
        createdAt: now,
        updatedAt: now,
      });

      const logRef = firestore.collection('activityLogs').doc();
      batch.set(logRef, {
        actorId: createdUid,
        actorName: input.fullName,
        actorRole: 'student',
        action: 'self_register_student_account',
        entityType: 'user',
        entityId: createdUid,
        metadata: sanitizeAuditMetadata({
          email: input.email,
          studentNumber: input.studentNumber,
          program: input.program,
          role: 'student',
          registrationType: 'self_registration',
        }),
        createdAt: now,
      });

      await batch.commit();
    } catch {
      let deleted = false;
      try {
        if (createdUid) {
          await auth.deleteUser(createdUid);
          deleted = true;
        }
      } catch {
        // Keep the original profile-creation failure as the user-facing error.
      }
      compensationSucceeded = deleted;

      // Keep provider/database details in server logs only. Public registration
      // must not expose internal Firestore or Auth error messages.
      throw new Error(
        deleted
          ? 'Registration could not complete. Please try again.'
          : 'Registration could not complete. Please contact an administrator.'
      );
    }

    return {
      success: true as const,
      user: {
        uid: createdUid,
        email: input.email,
        fullName: input.fullName,
        role: 'student' as const,
      },
    };
  } catch (error: unknown) {
    logSafeAuthError(
      'student_self_registration',
      error,
      compensationSucceeded === undefined ? undefined : { compensationSucceeded }
    );
    return {
      success: false as const,
      error: mapLifecycleError(error, 'Unable to create your account. Please try again.'),
    };
  }
}
