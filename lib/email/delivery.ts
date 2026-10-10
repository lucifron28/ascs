import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  SendEmailResult,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
} from './service';
import type {
  RegistrationEmailDelivery,
  EmailDeliveryStatus,
  RegistrationDecisionType,
} from '@/lib/types/firestore';
import { sanitizeAuditMetadata } from '@/lib/admin/lifecycle-validation';

/**
 * Derives the canonical delivery status from a SendEmailResult.
 * Ensures simulated deliveries are distinctly tagged and never misrepresented as sent.
 */
export function resolveDeliveryStatus(result: SendEmailResult): EmailDeliveryStatus {
  if (!result.success) return 'failed';
  if (result.simulated) return 'simulated';
  return 'sent';
}

export interface RecordRegistrationEmailDeliveryParams {
  recipientEmail: string;
  recipientName: string;
  decisionType: RegistrationDecisionType;
  rejectionReason?: string | null;
  emailResult: SendEmailResult;
  userId?: string;
  actorId: string;
}

/**
 * Creates and persists a minimal, server-protected delivery record in Firestore.
 * This record retains recipient email, name, and rejection reason even if the student
 * account is deleted upon rejection.
 */
export async function recordRegistrationEmailDelivery(
  params: RecordRegistrationEmailDeliveryParams
): Promise<RegistrationEmailDelivery> {
  const firestore = getAdminFirestore();
  const deliveryRef = firestore.collection('registrationEmailDeliveries').doc();
  const deliveryId = deliveryRef.id;
  const now = new Date().toISOString();
  const status = resolveDeliveryStatus(params.emailResult);

  const record: RegistrationEmailDelivery = {
    deliveryId,
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    decisionType: params.decisionType,
    rejectionReason: params.rejectionReason || null,
    status,
    lastAttemptAt: now,
    error: params.emailResult.error || null,
    attemptsCount: 1,
    createdAt: now,
    updatedAt: now,
    userId: params.userId,
    providerId: params.emailResult.id || null,
    actorId: params.actorId,
  };

  await deliveryRef.set(record);
  return record;
}

export interface RetryRegistrationEmailResult {
  success: boolean;
  status: EmailDeliveryStatus;
  error?: string | null;
  delivery: RegistrationEmailDelivery;
}

/**
 * Retries a previously failed or pending registration decision email.
 * Guarantees:
 * 1. Admin authorization is verified by caller before invoking.
 * 2. Idempotency: Does not re-send if status is already 'sent'.
 * 3. Does NOT repeat or mutate any account lifecycle decisions.
 * 4. Preserves rejection reason for rejected students whose accounts were deleted.
 * 5. Logs an audit activity log entry upon execution.
 */
export async function retryRegistrationEmail(
  deliveryId: string,
  adminUid: string,
  adminName: string = 'Administrator'
): Promise<RetryRegistrationEmailResult> {
  if (!deliveryId || typeof deliveryId !== 'string') {
    throw new Error('Delivery ID is required for email retry.');
  }

  const firestore = getAdminFirestore();
  const deliveryRef = firestore.collection('registrationEmailDeliveries').doc(deliveryId);
  const deliverySnap = await deliveryRef.get();

  if (!deliverySnap.exists) {
    throw new Error('Registration email delivery record not found.');
  }

  const delivery = deliverySnap.data() as RegistrationEmailDelivery;

  // Prevent accidental duplicate sends if email already succeeded
  if (delivery.status === 'sent') {
    throw new Error('Email has already been successfully delivered.');
  }

  // Execute email dispatch based on recorded decision type
  let emailResult: SendEmailResult;
  try {
    if (delivery.decisionType === 'approved') {
      emailResult = await sendRegistrationApprovedEmail({
        to: delivery.recipientEmail,
        fullName: delivery.recipientName,
      });
    } else {
      emailResult = await sendRegistrationRejectedEmail({
        to: delivery.recipientEmail,
        fullName: delivery.recipientName,
        rejectionReason: delivery.rejectionReason || 'Registration could not be approved.',
      });
    }
  } catch (err: unknown) {
    emailResult = {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected failure during email retry',
    };
  }

  const newStatus = resolveDeliveryStatus(emailResult);
  const now = new Date().toISOString();

  const updatedDelivery: RegistrationEmailDelivery = {
    ...delivery,
    status: newStatus,
    lastAttemptAt: now,
    error: emailResult.error || null,
    attemptsCount: (delivery.attemptsCount || 1) + 1,
    updatedAt: now,
    providerId: emailResult.id || delivery.providerId || null,
    lastRetriedBy: adminUid,
  };

  // Atomically update delivery record
  await deliveryRef.update({
    status: newStatus,
    lastAttemptAt: now,
    error: emailResult.error || null,
    attemptsCount: updatedDelivery.attemptsCount,
    updatedAt: now,
    providerId: updatedDelivery.providerId,
    lastRetriedBy: adminUid,
  });

  // Log activity in activityLogs
  const logRef = firestore.collection('activityLogs').doc();
  await logRef.set({
    actorId: adminUid,
    actorName: adminName,
    actorRole: 'admin',
    action: 'retry_registration_email',
    entityType: 'registration_email_delivery',
    entityId: deliveryId,
    metadata: sanitizeAuditMetadata({
      recipientEmail: delivery.recipientEmail,
      decisionType: delivery.decisionType,
      previousStatus: delivery.status,
      newStatus,
      attemptsCount: updatedDelivery.attemptsCount,
      error: emailResult.error || null,
    }),
    createdAt: now,
  }).catch(() => {});

  return {
    success: newStatus !== 'failed',
    status: newStatus,
    error: emailResult.error || null,
    delivery: updatedDelivery,
  };
}
