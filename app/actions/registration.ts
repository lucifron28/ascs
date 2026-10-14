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
      // Release reservation when Firebase Auth creation fails
      await releaseStudentNumberReservation(firestore, input.studentNumber, 'pending').catch((relErr) => {
        console.error('[Reservation Cleanup Error] Failed to release reservation on Auth creation failure:', relErr);
      });
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
      try {
        if (createdUid) {
          await auth.deleteUser(createdUid);
          deleted = true;
        }
      } catch {
        // Keep the original profile-creation failure as the user-facing error.
      }
      if (deleted) {
        await releaseStudentNumberReservation(firestore, input.studentNumber, createdUid).catch((relErr) => {
          console.error('[Reservation Cleanup Error] Failed to release reservation after Auth cleanup:', relErr);
        });
      } else {
        console.error(
          `[Compensation Failure] Auth account ${createdUid} could not be deleted; retaining student number reservation for ${input.studentNumber} to prevent duplicate identity collision.`
        );
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

    // Generate and dispatch email verification link for student email ownership verification
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const verificationLink = await auth.generateEmailVerificationLink(input.email);
      const emailResult = await sendEmail({
        to: input.email,
        subject: 'ASCS PKM — Verify your student email address',
        text: `Hello ${input.fullName},\n\nPlease verify your email address for the Automated Student Clearance System (ASCS) by visiting the link below:\n\n${verificationLink}\n\nOnce your email is verified and your account is approved by an administrator, you will be able to sign in and submit your clearance application.\n\nBest regards,\nASCS PKM Administration`,
        html: `<!DOCTYPE html><html><body><h2>ASCS PKM</h2><p>Hello <strong>${escapeHtml(input.fullName)}</strong>,</p><p>Please verify your email address for your student account registration by clicking the link below:</p><p><a href="${verificationLink}">Verify Email Address</a></p><p>Once your email address is verified and your account is approved by an administrator, you will be able to sign in.</p></body></html>`,
      });
      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailError = emailResult.error || 'Failed to dispatch email';
      }
    } catch (verifyEmailErr) {
      console.warn('[Email Warning] Could not dispatch email verification link:', verifyEmailErr);
      emailSent = false;
      emailError = verifyEmailErr instanceof Error ? verifyEmailErr.message : 'Email dispatch error';
    }

    return {
      success: true as const,
      user: {
        uid: createdUid,
        email: input.email,
        fullName: input.fullName,
        role: 'student' as const,
      },
      emailSent,
      emailError,
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
    if (!data?.email || typeof data.email !== 'string' || !data.email.trim()) {
      throw new Error('Email address is required.');
    }
    const normalized = data.email.trim().toLowerCase();
    const auth = getAdminAuth();
    const firestore = getAdminFirestore();
    // 1. Atomic 60-second cooldown check and lease claim within a transaction
    const nowMs = Date.now();
    const cooldownDocId = Buffer.from(normalized).toString('hex');
    const cooldownRef = firestore.collection('verificationCooldowns').doc(cooldownDocId);

    await firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(cooldownRef);
      if (snap.exists) {
        const lastReq = snap.data()?.lastRequestedAt;
        if (lastReq && nowMs - new Date(lastReq).getTime() < 60_000) {
          const waitSecs = Math.ceil((60_000 - (nowMs - new Date(lastReq).getTime())) / 1000);
          throw new Error(`Please wait ${waitSecs} second${waitSecs === 1 ? '' : 's'} before requesting another verification email.`);
        }
      }
      transaction.set(cooldownRef, {
        email: normalized,
        lastRequestedAt: new Date(nowMs).toISOString(),
      });
    });

    // Generic response message to prevent account enumeration
    const genericResponse = {
      success: true as const,
      message: 'If an unverified student account exists for this email address, a verification link has been sent. Please check your inbox.',
    };

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(normalized);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
      if (code === 'auth/user-not-found') {
        return genericResponse;
      }
      throw err;
    }

    if (userRecord.emailVerified) {
      return genericResponse;
    }

    const userDoc = await firestore.collection('users').doc(userRecord.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'student') {
      return genericResponse;
    }

    const verificationLink = await auth.generateEmailVerificationLink(normalized);
    const emailResult = await sendEmail({
      to: normalized,
      subject: 'ASCS PKM — Verify your student email address',
      text: `Hello ${userDoc.data()?.fullName || 'Student'},\n\nPlease verify your email address by visiting the link below:\n\n${verificationLink}\n\nBest regards,\nASCS PKM Administration`,
      html: `<!DOCTYPE html><html><body><h2>ASCS PKM</h2><p>Hello <strong>${escapeHtml(userDoc.data()?.fullName || 'Student')}</strong>,</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verificationLink}">Verify Email Address</a></p></body></html>`,
    });

    if (!emailResult.success) {
      return {
        success: false as const,
        error: 'Unable to send verification email at this time. Please try again later.',
      };
    }

    return genericResponse;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Please wait')) {
      return {
        success: false as const,
        error: message,
      };
    }
    return {
      success: false as const,
      error: 'Unable to process verification request at this time. Please try again later.',
    };
  }
}
