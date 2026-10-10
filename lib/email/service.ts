/**
 * Transactional email service for ASCS PKM using Gmail SMTP via nodemailer.
 * Supports Gmail App Passwords and standard SMTP delivery.
 *
 * Fully protected with test-domain guards and emulator detection to avoid sending real
 * emails to fictional accounts or during automated test/emulator runs.
 */

import nodemailer from 'nodemailer';
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
 * Creates and returns a nodemailer transporter configured for Gmail SMTP.
 */
export function getMailTransporter() {
  const user = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const rawPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
  // Gmail App Passwords may include spaces when copied from Google Account; strip them
  const pass = rawPass.replace(/\s+/g, '').trim();

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a transactional email using Gmail SMTP via nodemailer.
 * Safely falls back to simulation mode in tests, emulators, or for fictional test addresses.
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

  const transporter = getMailTransporter();
  if (!transporter) {
    return {
      success: false,
      error: 'Gmail SMTP credentials (GMAIL_USER and GMAIL_APP_PASSWORD) are not configured',
    };
  }

  const user = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const senderEmail = from || process.env.EMAIL_FROM || `ASCS PKM <${user}>`;

  try {
    const info = await transporter.sendMail({
      from: senderEmail,
      to,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });

    return {
      success: true,
      id: info.messageId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown network failure while dispatching email via Gmail SMTP',
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
