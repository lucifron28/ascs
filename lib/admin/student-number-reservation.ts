import type { Firestore, DocumentReference } from 'firebase-admin/firestore';

export interface StudentNumberReservationRecord {
  studentNumber: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReservationReleaseResult {
  released: boolean;
  reason?: 'reservation_not_found' | 'ownership_mismatch' | 'invalid_input';
}

/**
 * Atomically reserves a student number using a dedicated collection.
 * Uses document ID uniqueness in a Firestore transaction to eliminate race conditions
 * during concurrent public self-registrations and admin student creations.
 */
export async function reserveStudentNumberAtomically(
  firestore: Firestore,
  studentNumber: string,
  userId: string,
  now: string
): Promise<DocumentReference> {
  const normalized = studentNumber.trim().toUpperCase();
  const reservationRef = firestore.collection('studentNumberReservations').doc(normalized);

  await firestore.runTransaction(async (transaction) => {
    const snap = await transaction.get(reservationRef);
    if (snap.exists) {
      throw new Error(`Student number '${studentNumber}' is already registered to another student.`);
    }

    // Secondary check against students collection for legacy/seeded records
    const existingStudentQuery = await transaction.get(
      firestore.collection('students').where('studentNumber', '==', studentNumber).limit(1)
    );
    if (!existingStudentQuery.empty) {
      throw new Error(`Student number '${studentNumber}' is already registered to another student.`);
    }

    transaction.set(reservationRef, {
      studentNumber: normalized,
      userId,
      createdAt: now,
    });
  });

  return reservationRef;
}

/**
 * Associates an existing reservation with the actual user UID once Auth user creation succeeds.
 */
export async function associateStudentNumberReservation(
  firestore: Firestore,
  studentNumber: string,
  actualUserId: string,
  updatedAt: string = new Date().toISOString()
): Promise<void> {
  if (!studentNumber || typeof studentNumber !== 'string') return;
  const normalized = studentNumber.trim().toUpperCase();
  const reservationRef = firestore.collection('studentNumberReservations').doc(normalized);
  await reservationRef.update({
    userId: actualUserId,
    updatedAt,
  });
}

/**
 * Releases a reserved student number upon creation rollback or permanent account deletion.
 * Atomically verifies reservation ownership within a Firestore transaction before deleting,
 * strictly preventing the release of another student's reservation.
 */
export async function releaseStudentNumberReservation(
  firestore: Firestore,
  studentNumber: string,
  expectedUserId: string
): Promise<ReservationReleaseResult> {
  if (!studentNumber || typeof studentNumber !== 'string') {
    throw new Error('Student number is required for reservation release.');
  }
  if (!expectedUserId || typeof expectedUserId !== 'string') {
    throw new Error('Expected user ID is required for reservation release to verify ownership.');
  }

  const normalized = studentNumber.trim().toUpperCase();
  const reservationRef = firestore.collection('studentNumberReservations').doc(normalized);

  return await firestore.runTransaction(async (transaction) => {
    const snap = await transaction.get(reservationRef);
    if (!snap.exists) {
      return { released: false, reason: 'reservation_not_found' as const };
    }

    const data = snap.data() as StudentNumberReservationRecord;
    // Strict ownership verification: only release if reservation is owned by the expected user
    if (data.userId !== expectedUserId) {
      console.warn(
        `[Reservation Ownership Guard] Refused to release reservation for '${normalized}'. Owned by '${data.userId}', expected '${expectedUserId}'.`
      );
      return { released: false, reason: 'ownership_mismatch' as const };
    }

    transaction.delete(reservationRef);
    return { released: true };
  });
}
