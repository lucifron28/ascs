import { NextResponse } from 'next/server';
import { getSessionCookieName } from './session-name';

export interface PasswordChangeRecoveryResult {
  clearFields: boolean;
  signOut: boolean;
  redirectTo: string | null;
  message: string | null;
}

/**
 * Creates a NextResponse for password mutation outcomes.
 * Guarantees passwordChanged: true, Cache-Control: no-store, and cookie clearance header.
 */
export function createPasswordChangedResponse(
  body: Record<string, unknown>,
  status: number,
  isProduction = process.env.NODE_ENV === 'production'
): NextResponse {
  const response = NextResponse.json(
    {
      ...body,
      passwordChanged: true,
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );

  response.cookies.set(getSessionCookieName(), '', {
    maxAge: 0,
    httpOnly: true,
    secure: isProduction,
    path: '/',
    sameSite: 'lax',
  });

  return response;
}

/**
 * Pure decision helper for client-side password change response processing.
 */
export function getPasswordChangeRecovery(
  responseOk: boolean,
  body: {
    passwordChanged?: boolean;
    error?: string;
  }
): PasswordChangeRecoveryResult {
  if (!responseOk && body.passwordChanged === true) {
    return {
      clearFields: true,
      signOut: true,
      redirectTo: '/login',
      message:
        body.error ||
        'Your password changed, but synchronization is incomplete. Sign in using the new password.',
    };
  }

  if (responseOk && body.passwordChanged === true) {
    return {
      clearFields: true,
      signOut: true,
      redirectTo: '/login',
      message: body.error || null,
    };
  }

  return {
    clearFields: false,
    signOut: false,
    redirectTo: null,
    message: body.error || null,
  };
}
