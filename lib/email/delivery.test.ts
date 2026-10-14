import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeliveryStatus, isDeliveryAbandoned, isDeliveryRetryable, SENDING_LEASE_TIMEOUT_MS } from './delivery';
import type { SendEmailResult } from './service';
import type { RegistrationEmailDelivery } from '@/lib/types/firestore';

test('1. resolveDeliveryStatus classifies provider outcomes accurately', () => {
  // Provider failure -> 'failed'
  const failedResult: SendEmailResult = {
    success: false,
    error: 'Domain not verified',
  };
  assert.equal(resolveDeliveryStatus(failedResult), 'failed');

  // Test address or emulator simulation -> 'simulated'
  const simulatedResult: SendEmailResult = {
    success: true,
    simulated: true,
    id: 'sim-12345',
  };
  assert.equal(resolveDeliveryStatus(simulatedResult), 'simulated');

  // Real provider send -> 'sent'
  const realResult: SendEmailResult = {
    success: true,
    id: 'msg_re_abc123',
  };
  assert.equal(resolveDeliveryStatus(realResult), 'sent');
});

test('2. resolveDeliveryStatus never conflates simulated delivery with sent delivery', () => {
  const simulated: SendEmailResult = { success: true, simulated: true };
  assert.notEqual(resolveDeliveryStatus(simulated), 'sent');
  assert.equal(resolveDeliveryStatus(simulated), 'simulated');
});

test('3. resolveDeliveryStatus classifies unexpected exceptions as failed, never simulated', () => {
  const unhandledExceptionResult: SendEmailResult = {
    success: false,
    error: 'ECONNRESET: Connection reset by peer',
  };
  assert.equal(resolveDeliveryStatus(unhandledExceptionResult), 'failed');
  assert.notEqual(resolveDeliveryStatus(unhandledExceptionResult), 'simulated');
});

test('4. resolveDeliveryStatus handles null or empty messageId safely', () => {
  const missingIdResult: SendEmailResult = {
    success: true,
  };
  assert.equal(resolveDeliveryStatus(missingIdResult), 'sent');
});

test('5. isDeliveryAbandoned detects sending records exceeding lease duration', () => {
  const baseDelivery: RegistrationEmailDelivery = {
    deliveryId: 'del-1',
    recipientEmail: 'student@example.test',
    recipientName: 'Student',
    decisionType: 'approved',
    rejectionReason: null,
    status: 'sending',
    lastAttemptAt: new Date(Date.now() - 30_000).toISOString(), // 30s ago
    error: null,
    attemptsCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Within 2-minute lease -> not abandoned
  assert.equal(isDeliveryAbandoned(baseDelivery), false);

  // Past 2-minute lease -> abandoned
  const abandonedDelivery: RegistrationEmailDelivery = {
    ...baseDelivery,
    lastAttemptAt: new Date(Date.now() - (SENDING_LEASE_TIMEOUT_MS + 5000)).toISOString(),
  };
  assert.equal(isDeliveryAbandoned(abandonedDelivery), true);

  // Non-sending status is never abandoned
  assert.equal(isDeliveryAbandoned({ ...abandonedDelivery, status: 'failed' }), false);
  assert.equal(isDeliveryAbandoned({ ...abandonedDelivery, status: 'sent' }), false);
});

test('6. isDeliveryRetryable permits failed and abandoned sending records, rejecting sent', () => {
  const base: RegistrationEmailDelivery = {
    deliveryId: 'del-2',
    recipientEmail: 'student@example.test',
    recipientName: 'Student',
    decisionType: 'rejected',
    rejectionReason: 'Invalid student ID',
    status: 'failed',
    lastAttemptAt: new Date().toISOString(),
    error: 'SMTP connection timeout',
    attemptsCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Failed delivery is retryable
  assert.equal(isDeliveryRetryable(base), true);

  // Sent delivery is NOT retryable
  assert.equal(isDeliveryRetryable({ ...base, status: 'sent', error: null }), false);

  // Active sending is NOT retryable
  assert.equal(isDeliveryRetryable({ ...base, status: 'sending', error: null }), false);

  // Abandoned sending (timed out) IS retryable
  const timedOutSending: RegistrationEmailDelivery = {
    ...base,
    status: 'sending',
    lastAttemptAt: new Date(Date.now() - (SENDING_LEASE_TIMEOUT_MS + 1000)).toISOString(),
  };
  assert.equal(isDeliveryRetryable(timedOutSending), true);
});
