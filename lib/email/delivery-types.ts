export type EmailDeliveryStatus = 'sent' | 'failed' | 'simulated' | 'sending';
export type RegistrationDecisionType = 'approved' | 'rejected';

export interface RegistrationEmailDelivery {
  deliveryId: string;
  recipientEmail: string;
  recipientName: string;
  decisionType: RegistrationDecisionType;
  rejectionReason: string | null;
  status: EmailDeliveryStatus;
  lastAttemptAt: string;
  error: string | null;
  attemptsCount: number;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  providerId?: string | null;
  actorId?: string;
  lastRetriedBy?: string | null;
  currentAttemptId?: string | null;
  smtpDeliveryGuarantee?: 'at_least_once' | 'simulated';
}

/** Maximum duration in ms that an in-progress send attempt is locked before considered abandoned (2 minutes). */
export const SENDING_LEASE_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Returns true if a delivery record is in 'sending' status but has exceeded the lease duration.
 */
export function isDeliveryAbandoned(delivery: RegistrationEmailDelivery, now: number = Date.now()): boolean {
  if (delivery.status !== 'sending') return false;
  const lastAttemptTime = new Date(delivery.lastAttemptAt || delivery.updatedAt || 0).getTime();
  return now - lastAttemptTime >= SENDING_LEASE_TIMEOUT_MS;
}

/**
 * Returns true if a delivery record can be retried by an administrator (failed or abandoned sending).
 */
export function isDeliveryRetryable(delivery: RegistrationEmailDelivery, now: number = Date.now()): boolean {
  return delivery.status === 'failed' || isDeliveryAbandoned(delivery, now);
}
