import type { Firestore, DocumentReference } from 'firebase-admin/firestore';

export interface StudentNumberReservationRecord {
  studentNumber: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
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
 * Verifies reservation ownership if expectedUserId is supplied to prevent deleting
 * reservations belonging to another student.
 */
export async function releaseStudentNumberReservation(
  firestore: Firestore,
  studentNumber: string,
  expectedUserId?: string
): Promise<void> {
  if (!studentNumber || typeof studentNumber !== 'string') return;
  const normalized = studentNumber.trim().toUpperCase();
  const reservationRef = firestore.collection('studentNumberReservations').doc(normalized);

  if (expectedUserId) {
    const snap = await reservationRef.get();
    if (!snap.exists) return;
    const data = snap.data() as StudentNumberReservationRecord;
    // Only permit release if the reservation is owned by the expected user
    if (data.userId !== expectedUserId) {
      console.warn(
        `[Reservation Ownership Guard] Refused to release reservation for '${normalized}'. Owned by '${data.userId}', expected '${expectedUserId}'.`
      );
      return;
    }
  }

  try {
    await reservationRef.delete();
  } catch (err: unknown) {
    console.error(`[Reservation Cleanup Failure] Could not delete reservation doc for '${normalized}':`, err);
    throw new Error(`Failed to release student number reservation: ${err instanceof Error ? err.message : String(err)}`);
  }
}
