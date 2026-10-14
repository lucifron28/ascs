import type { Firestore, DocumentReference } from 'firebase-admin/firestore';

export interface StudentNumberReservationRecord {
  studentNumber: string;
  userId: string;
  createdAt: string;
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
 * Releases a reserved student number upon creation rollback or permanent account deletion.
 */
export async function releaseStudentNumberReservation(
  firestore: Firestore,
  studentNumber: string
): Promise<void> {
  if (!studentNumber || typeof studentNumber !== 'string') return;
  const normalized = studentNumber.trim().toUpperCase();
  await firestore.collection('studentNumberReservations').doc(normalized).delete().catch(() => {});
}
