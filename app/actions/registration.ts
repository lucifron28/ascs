'use server';

import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import {
  logSafeAuthError,
  mapLifecycleError,
  sanitizeAuditMetadata,
  StudentRegistrationInput,
  validateStudentRegistrationInput,
} from '@/lib/admin/lifecycle-validation';
import {
  reserveStudentNumberAtomically,
  releaseStudentNumberReservation,
} from '@/lib/admin/student-number-reservation';

async function releaseRegistrationReservation(
  firestore: ReturnType<typeof getAdminFirestore>,
  studentNumber: string,
  expectedUserIds: string | readonly string[],
  operation: string
): Promise<boolean> {
  try {
    const result = await releaseStudentNumberReservation(firestore, studentNumber, expectedUserIds);
    if (result.released || result.reason === 'reservation_not_found') {
      return true;
    }
    if (!result.released) {
      console.error('[Reservation Cleanup Error] Registration reservation was not released:', {
        operation,
        studentNumber,
        reason: result.reason,
      });
    }
    return false;
  } catch (error: unknown) {
    console.error('[Reservation Cleanup Error] Failed to release registration reservation:', {
      operation,
      studentNumber,
      error,
    });
    return false;
  }
}

async function deleteAuthUserIfPresent(auth: ReturnType<typeof getAdminAuth>, uid: string): Promise<void> {
  try {
    await auth.deleteUser(uid);
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') {
      throw error;
    }
  }
}

async function confirmAuthUserAbsent(
  auth: ReturnType<typeof getAdminAuth>,
  email: string
): Promise<boolean> {
  try {
    await auth.getUserByEmail(email);
    return false;
  } catch (error: unknown) {
    return (error as { code?: string }).code === 'auth/user-not-found';
  }
}
/**
 * Create a student-only account from the public registration form.
 *
 * The role and account flags are fixed here; the browser cannot choose a
 * privileged role or write any profile documents directly.
 *
 * Email ownership is not independently verified; student identity review
 * and account approval are the Administrator's responsibility.
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

    const nowIso = new Date().toISOString();
    // Atomically reserve student number to prevent concurrent duplicate registrations
    await reserveStudentNumberAtomically(firestore, input.studentNumber, 'pending', nowIso);

    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.fullName,
        emailVerified: false,
      });
      createdUid = userRecord.uid;
    } catch (authCreateErr) {
      // Auth may have accepted a create request even when its response was lost.
      const authAbsent = await confirmAuthUserAbsent(auth, input.email);
      const reservationReleased = authAbsent
        ? await releaseRegistrationReservation(
            firestore,
            input.studentNumber,
            'pending',
            'self_registration_auth_creation'
          )
        : false;
      if (!authAbsent) {
        console.error(
          '[Reservation Cleanup Error] Retaining student number reservation because Auth absence was not confirmed:',
          { operation: 'self_registration_auth_creation', studentNumber: input.studentNumber }
        );
      }
      compensationSucceeded = authAbsent && reservationReleased;
      if (!compensationSucceeded) {
        throw new Error('Registration could not complete. Reservation cleanup needs administrator attention.');
      }
      throw authCreateErr;
    }
    try {
      await auth.setCustomUserClaims(createdUid, {
        role: 'student',
        accountStatus: 'pending_approval',
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
        accountStatus: 'pending_approval',
        isActive: false,
        mustChangePassword: false,
        studentNumber: input.studentNumber,
        program: input.program,
        yearLevel: input.yearLevel,
        semester: input.semester,
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
        accountStatus: 'pending_approval',
        isActive: false,
      });

      const studentRef = firestore.collection('students').doc(createdUid);
      batch.set(studentRef, {
        uid: createdUid,
        studentNumber: input.studentNumber,
        fullName: input.fullName,
        email: input.email,
        program: input.program,
        yearLevel: input.yearLevel,
        semester: input.semester,
        section: input.section,
        contactNumber: input.contactNumber,
        createdAt: now,
        updatedAt: now,
        accountStatus: 'pending_approval',
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
          accountStatus: 'pending_approval',
          registrationType: 'self_registration',
        }),
        createdAt: now,
      });
      // Associate student number reservation with actual user UID
      const reservationRef = firestore.collection('studentNumberReservations').doc(input.studentNumber.trim().toUpperCase());
      batch.update(reservationRef, {
        userId: createdUid,
        updatedAt: now,
      });

      await batch.commit();

      const [authRecord, userProfileSnap, publicProfileSnap, studentProfileSnap] = await Promise.all([
        auth.getUser(createdUid),
        firestore.collection('users').doc(createdUid).get(),
        firestore.collection('publicUsers').doc(createdUid).get(),
        firestore.collection('students').doc(createdUid).get(),
      ]);
      const userProfile = userProfileSnap.data();
      const publicProfile = publicProfileSnap.data();
      const studentProfile = studentProfileSnap.data();
      if (
        authRecord.customClaims?.role !== 'student' ||
        authRecord.customClaims?.accountStatus !== 'pending_approval' ||
        userProfile?.role !== 'student' ||
        userProfile?.accountStatus !== 'pending_approval' ||
        userProfile?.isActive !== false ||
        publicProfile?.role !== 'student' ||
        publicProfile?.accountStatus !== 'pending_approval' ||
        publicProfile?.isActive !== false ||
        studentProfile?.program !== input.program ||
        studentProfile?.yearLevel !== input.yearLevel ||
        studentProfile?.semester !== input.semester
      ) {
        throw new Error('Student registration synchronization verification failed across Auth, users, publicUsers, and students.');
      }
    } catch {
      let deleted = false;
      let reservationReleased = false;
      try {
        if (createdUid) {
          await deleteAuthUserIfPresent(auth, createdUid);
          deleted = true;
        }
      } catch {
        // Keep the original profile-creation failure as the user-facing error.
      }
      if (deleted) {
        reservationReleased = await releaseRegistrationReservation(
          firestore,
          input.studentNumber,
          ['pending', createdUid],
          'self_registration_profile_rollback'
        );
      } else {
        console.error(
          `[Compensation Failure] Auth account ${createdUid} could not be deleted; retaining student number reservation for ${input.studentNumber} to prevent duplicate identity collision.`
        );
      }
      compensationSucceeded = deleted && reservationReleased;

      // Keep provider/database details in server logs only. Public registration
      // must not expose internal Firestore or Auth error messages.
      throw new Error(
        deleted && reservationReleased
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
