/**
 * Transactional email service for ASCS PKM.
 * Uses native fetch to interact directly with the Resend REST API (https://api.resend.com/emails)
 * without requiring external npm dependencies.
 *
 * Fully protected with test-domain guards and emulator detection to avoid sending real
 * emails to fictional accounts or in test environments.
 */

import {
  renderRegistrationApprovedEmail,
  renderRegistrationRejectedEmail,
} from './templates';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  simulated?: boolean;
  id?: string;
  error?: string;
}

/**
 * Checks whether an email address belongs to a test, demo, or fictional domain.
 */
export function isFictionalOrTestEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return true;
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith('.test') ||
    normalized.endsWith('.example') ||
    normalized.endsWith('@example.com') ||
    normalized.endsWith('@example.org') ||
    normalized.endsWith('@example.net') ||
    normalized.endsWith('@localhost') ||
    normalized.includes('example.test')
  );
}

/**
 * Checks whether the current runtime environment is automated testing or emulator.
 */
export function isTestOrEmulatorEnvironment(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') return true;
  if (process.env.FIREBASE_EMULATOR_HUB) return true;
  return false;
}

/**
 * Sends a transactional email using the Resend REST API.
 * Safely falls back to simulation mode in tests, emulators, or if credentials are unconfigured.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, text, from, replyTo } = options;

  // Safety guard: Never send actual emails to fictional demo addresses or during test/emulator runs
  if (isFictionalOrTestEmail(to) || isTestOrEmulatorEnvironment()) {
    return {
      success: true,
      simulated: true,
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY environment variable is not configured',
    };
  }

  const senderEmail = from || process.env.EMAIL_FROM || 'ASCS PKM <onboarding@resend.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: senderEmail,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage =
        (data && typeof data.message === 'string' && data.message) ||
        (data && typeof data.name === 'string' && data.name) ||
        `HTTP ${response.status}: ${response.statusText}`;

      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      id: data?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown network failure while dispatching email',
    };
  }
}

/**
 * Sends a registration approval email to a student.
 */
export async function sendRegistrationApprovedEmail(params: {
  to: string;
  fullName: string;
  loginUrl?: string;
}): Promise<SendEmailResult> {
  const loginUrl =
    params.loginUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://ascs-one.vercel.app/login';

  const { subject, html, text } = renderRegistrationApprovedEmail({
    fullName: params.fullName,
    email: params.to,
    loginUrl,
  });

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
  });
}

/**
 * Sends a registration rejection email to a student, including the mandatory rejection reason.
 */
export async function sendRegistrationRejectedEmail(params: {
  to: string;
  fullName: string;
  rejectionReason: string;
}): Promise<SendEmailResult> {
  const { subject, html, text } = renderRegistrationRejectedEmail({
    fullName: params.fullName,
    email: params.to,
    rejectionReason: params.rejectionReason,
  });

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
  });
}
