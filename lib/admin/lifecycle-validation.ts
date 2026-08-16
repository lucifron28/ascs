import { randomInt } from 'node:crypto';
import type { UserRole } from '@/lib/types/roles';
import { isAcademicProgramCode } from '@/lib/academic-programs';

export interface StudentAccountInput {
  email: string;
  studentNumber: string;
  fullName: string;
  program: string;
  yearLevel: string;
  section: string;
  contactNumber?: string | null;
  temporaryPassword?: string;
}

export interface StudentRegistrationInput extends Omit<StudentAccountInput, 'temporaryPassword'> {
  password: string;
  confirmPassword: string;
}

export interface StaffAccountInput {
  email: string;
  fullName: string;
  role: UserRole;
  contactNumber?: string | null;
  temporaryPassword?: string;
}

export const VALID_ROLES: UserRole[] = [
  'student',
  'librarian',
  'accountant',
  'osa_coordinator',
  'guidance_counselor',
  'area_chair',
  'adviser',
  'dean',
  'admin',
];

export const VALID_STAFF_ROLES: UserRole[] = [
  'librarian',
  'accountant',
  'osa_coordinator',
  'guidance_counselor',
  'area_chair',
  'dean',
  'admin',
];

/** Normalize and validate email address. */
export function validateEmail(email: unknown): string {
  if (typeof email !== 'string' || !email.trim()) {
    throw new Error('Email address is required.');
  }
  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    throw new Error(`Invalid email address format: ${email}`);
  }
  return normalized;
}

/** Normalize and validate student number. */
export function validateStudentNumber(studentNumber: unknown): string {
  if (typeof studentNumber !== 'string' || !studentNumber.trim()) {
    throw new Error('Student number is required.');
  }
  const normalized = studentNumber.trim().toUpperCase();
  if (normalized.length < 3) {
    throw new Error('Student number must be at least 3 characters.');
  }
  return normalized;
}

/** Validate temporary password strength. */
export function validateTemporaryPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Temporary password must be at least 8 characters long.');
  }
  return password;
}

/** Validate a password chosen during self-registration. */
export function validateRegistrationPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  return password;
}

/** Validate system role. */
export function validateRole(role: unknown, allowedRoles: UserRole[] = VALID_ROLES): UserRole {
  if (typeof role !== 'string' || !allowedRoles.includes(role as UserRole)) {
    throw new Error(`Invalid role specified: ${String(role)}.`);
  }
  return role as UserRole;
}

/** Validate input required for creating a student account. */
export function validateStudentInput(input: Partial<StudentAccountInput>): {
  email: string;
  studentNumber: string;
  fullName: string;
  program: string;
  yearLevel: string;
  section: string;
  contactNumber: string | null;
  temporaryPassword?: string;
} {
  const email = validateEmail(input.email);
  const studentNumber = validateStudentNumber(input.studentNumber);

  if (typeof input.fullName !== 'string' || !input.fullName.trim()) {
    throw new Error('Full name is required.');
  }
  if (typeof input.program !== 'string' || !input.program.trim()) {
    throw new Error('Program is required.');
  }
  const program = input.program.trim().toUpperCase();
  if (!isAcademicProgramCode(program)) {
    throw new Error(`Invalid Program Code: ${program}.`);
  }
  if (typeof input.yearLevel !== 'string' || !input.yearLevel.trim()) {
    throw new Error('Year level is required.');
  }
  if (typeof input.section !== 'string' || !input.section.trim()) {
    throw new Error('Section is required.');
  }

  let temporaryPassword: string | undefined;
  if (input.temporaryPassword !== undefined && input.temporaryPassword !== '') {
    temporaryPassword = validateTemporaryPassword(input.temporaryPassword);
  }

  return {
    email,
    studentNumber,
    fullName: input.fullName.trim(),
    program,
    yearLevel: input.yearLevel.trim(),
    section: input.section.trim(),
    contactNumber: input.contactNumber?.trim() || null,
    temporaryPassword,
  };
}

/** Validate the public student registration form without accepting any role fields. */
export function validateStudentRegistrationInput(input: Partial<StudentRegistrationInput>): {
  email: string;
  studentNumber: string;
  fullName: string;
  program: string;
  yearLevel: string;
  section: string;
  contactNumber: string | null;
  password: string;
} {
  const student = validateStudentInput(input);
  const password = validateRegistrationPassword(input.password);

  if (password !== input.confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  return {
    email: student.email,
    studentNumber: student.studentNumber,
    fullName: student.fullName,
    program: student.program,
    yearLevel: student.yearLevel,
    section: student.section,
    contactNumber: student.contactNumber,
    password,
  };
}

/** Validate input required for creating a staff account. */
export function validateStaffInput(input: Partial<StaffAccountInput>): {
  email: string;
  fullName: string;
  role: UserRole;
  contactNumber: string | null;
  temporaryPassword?: string;
} {
  const email = validateEmail(input.email);
  const role = validateRole(input.role, VALID_STAFF_ROLES);

  if (typeof input.fullName !== 'string' || !input.fullName.trim()) {
    throw new Error('Full name is required.');
  }

  let temporaryPassword: string | undefined;
  if (input.temporaryPassword !== undefined && input.temporaryPassword !== '') {
    temporaryPassword = validateTemporaryPassword(input.temporaryPassword);
  }

  return {
    email,
    fullName: input.fullName.trim(),
    role,
    contactNumber: input.contactNumber?.trim() || null,
    temporaryPassword,
  };
}

/** Ensure administrator is not attempting a dangerous operation on their own account. */
export function checkSelfOperation(adminUid: string, targetUid: string, operationName: string): void {
  if (adminUid === targetUid) {
    throw new Error(`Action blocked: You cannot perform ${operationName} on your own administrator account.`);
  }
}

/** Ensure the final active administrator account is protected. */
export function checkFinalActiveAdmin(activeAdminCount: number): void {
  if (activeAdminCount <= 1) {
    throw new Error('Action blocked: Cannot deactivate or demote the final active system administrator.');
  }
}

/** Ensure student-to-staff or staff-to-student role conversion is blocked. */
export function checkRoleConversion(currentRole: UserRole, targetRole: UserRole): void {
  const currentIsStudent = currentRole === 'student';
  const targetIsStudent = targetRole === 'student';
  if (currentIsStudent !== targetIsStudent) {
    throw new Error(
      `Changing between student and staff account types is not supported by this action. Create the correct account type or use a dedicated migration workflow.`
    );
  }
}

/** Strip sensitive password/credential fields from activity log metadata. */
export function sanitizeAuditMetadata<T extends Record<string, unknown>>(metadata: T): T {
  const sanitized: Record<string, unknown> = {};
  const forbiddenKeys = ['password', 'temporarypassword', 'token', 'secret', 'credential', 'idtoken'];

  for (const [key, value] of Object.entries(metadata)) {
    if (forbiddenKeys.includes(key.toLowerCase())) {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/** Synchronize accountStatus string and isActive boolean. */
export function getAccountStatusFlags(status: 'active' | 'inactive'): {
  accountStatus: 'active' | 'inactive';
  isActive: boolean;
} {
  const isActive = status === 'active';
  return { accountStatus: status, isActive };
}

/** Determine whether a user profile requires redirecting to mandatory password change. */
export function shouldRedirectToChangePassword(
  user: { mustChangePassword?: boolean; accountStatus?: string; isActive?: boolean } | null | undefined
): boolean {
  if (!user) return false;
  if (user.accountStatus === 'inactive' || user.isActive === false) return false;
  return user.mustChangePassword === true;
}

/** Generate a cryptographically secure random temporary password (minimum 12 chars with upper, lower, digit, symbol). */
export function generateRandomTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;

  const chars: string[] = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];

  for (let i = 0; i < 8; i++) {
    chars.push(all[randomInt(all.length)]);
  }

  // Fisher-Yates shuffle using cryptographically secure random numbers
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join('');
}
/** Map internal or raw Firebase error objects to safe, sanitized user-facing messages. */
export function mapLifecycleError(error: unknown, fallbackMessage: string = 'Operation failed'): string {
  if (!error) return fallbackMessage;

  const errObj = typeof error === 'object' && error !== null ? (error as { code?: string; message?: string }) : {};
  const message = error instanceof Error ? error.message : String(errObj.message || error);
  const code = errObj.code || '';

  const lowerMsg = message.toLowerCase();
  const lowerCode = code.toLowerCase();

  if (
    lowerMsg.includes('already registered') ||
    lowerMsg.includes('email-already-exists') ||
    lowerCode.includes('email-already-exists')
  ) {
    return 'The specified email address is already registered.';
  }
  if (
    lowerMsg.includes('user not found') ||
    lowerMsg.includes('user-not-found') ||
    lowerCode.includes('user-not-found')
  ) {
    return 'Target user or authentication account not found.';
  }
  if (
    lowerMsg.includes('weak-password') ||
    lowerCode.includes('weak-password') ||
    lowerMsg.includes('at least 8 characters') ||
    lowerMsg.includes('temporary password must be')
  ) {
    return 'Password does not meet required security standards.';
  }
  if (lowerMsg.includes('user-disabled') || lowerCode.includes('user-disabled')) {
    return 'The target user account is disabled.';
  }
  if (lowerMsg.includes('invalid role') || lowerMsg.includes('role conversion') || lowerMsg.includes('changing between student')) {
    return message;
  }
  if (
    lowerMsg.includes('action blocked') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('cannot deactivate') ||
    lowerMsg.includes('final active') ||
    lowerMsg.includes('requires explicit confirmation') ||
    lowerMsg.includes('manual intervention') ||
    lowerMsg.includes('compensation') ||
    lowerMsg.includes('cleanup completed') ||
    lowerMsg.includes('restored') ||
    lowerMsg.includes('disabled for safety') ||
    lowerMsg.includes('fallback') ||
    lowerMsg.includes('already registered to another student')
  ) {
    return message;
  }
  if (
    lowerMsg.includes('passwords do not match') ||
    lowerMsg.includes('email address is required') ||
    lowerMsg.includes('invalid email address') ||
    lowerMsg.includes('student number is required') ||
    lowerMsg.includes('full name is required') ||
    lowerMsg.includes('program is required') ||
    lowerMsg.includes('invalid program code') ||
    lowerMsg.includes('year level is required') ||
    lowerMsg.includes('section is required')
  ) {
    return message;
  }
  if (lowerMsg.includes('partial') || lowerMsg.includes('sync')) {
    return 'Operation encountered a synchronization issue. Check system audit logs.';
  }

  return fallbackMessage;
}
/** Extract safe error code string without logging raw credential payloads. */
export function getSafeErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return 'unknown';
}

export interface SafeLogContext {
  targetUid?: string;
  compensationSucceeded?: boolean;
  accountDisabled?: boolean;
  manualInterventionRequired?: boolean;
}

/** Log safe operation metadata server-side without exposing credentials or internal messages. */
export function logSafeAuthError(
  operation: string,
  error: unknown,
  context?: string | SafeLogContext
): void {
  const ctx: SafeLogContext =
    typeof context === 'string' ? { targetUid: context } : context || {};

  console.error('[Auth Safeguard]', {
    operation,
    code: getSafeErrorCode(error),
    ...(ctx.targetUid ? { targetUid: ctx.targetUid } : {}),
    ...(ctx.compensationSucceeded !== undefined
      ? { compensationSucceeded: ctx.compensationSucceeded }
      : {}),
    ...(ctx.accountDisabled !== undefined
      ? { accountDisabled: ctx.accountDisabled }
      : {}),
    ...(ctx.manualInterventionRequired !== undefined
      ? { manualInterventionRequired: ctx.manualInterventionRequired }
      : {}),
  });
}
