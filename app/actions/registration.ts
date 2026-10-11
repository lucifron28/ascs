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
import { sendEmail } from '@/lib/email/service';
import { escapeHtml } from '@/lib/email/templates';
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

    const nowIso = new Date().toISOString();
    // Atomically reserve student number to prevent concurrent duplicate registrations
    await reserveStudentNumberAtomically(firestore, input.studentNumber, 'pending', nowIso);

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
      try {
        if (createdUid) {
          await auth.deleteUser(createdUid);
          deleted = true;
        }
      } catch {
        // Keep the original profile-creation failure as the user-facing error.
      }
      await releaseStudentNumberReservation(firestore, input.studentNumber);
      compensationSucceeded = deleted;

      // Keep provider/database details in server logs only. Public registration
      // must not expose internal Firestore or Auth error messages.
      throw new Error(
        deleted
          ? 'Registration could not complete. Please try again.'
          : 'Registration could not complete. Please contact an administrator.'
      );
    }

    // Generate and dispatch email verification link for student email ownership verification
    try {
      const verificationLink = await auth.generateEmailVerificationLink(input.email);
      await sendEmail({
        to: input.email,
        subject: 'ASCS PKM — Verify your student email address',
        text: `Hello ${input.fullName},\n\nPlease verify your email address for the Automated Student Clearance System (ASCS) by visiting the link below:\n\n${verificationLink}\n\nOnce your email is verified and your account is approved by an administrator, you will be able to sign in and submit your clearance application.\n\nBest regards,\nASCS PKM Administration`,
        html: `<!DOCTYPE html><html><body><h2>ASCS PKM</h2><p>Hello <strong>${escapeHtml(input.fullName)}</strong>,</p><p>Please verify your email address for your student account registration by clicking the link below:</p><p><a href="${verificationLink}">Verify Email Address</a></p><p>Once your email address is verified and your account is approved by an administrator, you will be able to sign in.</p></body></html>`,
      });
    } catch (verifyEmailErr) {
      console.warn('[Email Warning] Could not dispatch email verification link:', verifyEmailErr);
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

/**
 * Resend verification email to an unverified student account.
 */
export async function resendStudentVerificationEmailAction(data: { email: string }) {
  try {
    if (!data?.email || typeof data.email !== 'string') {
      throw new Error('Email address is required.');
    }
    const normalized = data.email.trim().toLowerCase();
    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    const userRecord = await auth.getUserByEmail(normalized);
    if (userRecord.emailVerified) {
      return { success: true, message: 'Your email address is already verified. You may sign in.' };
    }

    const userDoc = await firestore.collection('users').doc(userRecord.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'student') {
      throw new Error('Verification link resend is only available for student accounts.');
    }

    const verificationLink = await auth.generateEmailVerificationLink(normalized);
    await sendEmail({
      to: normalized,
      subject: 'ASCS PKM — Verify your student email address',
      text: `Hello ${userDoc.data()?.fullName || 'Student'},\n\nPlease verify your email address by visiting the link below:\n\n${verificationLink}\n\nBest regards,\nASCS PKM Administration`,
      html: `<!DOCTYPE html><html><body><h2>ASCS PKM</h2><p>Hello <strong>${escapeHtml(userDoc.data()?.fullName || 'Student')}</strong>,</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verificationLink}">Verify Email Address</a></p></body></html>`,
    });

    return { success: true, message: 'Verification email sent. Please check your inbox.' };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend verification email.',
    };
  }
}
