import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieName } from '@/lib/auth/session';

export async function POST() {
  const response = NextResponse.json({ status: 'success' });
  
  // Clear the HTTP-only session cookie
  response.cookies.set(getSessionCookieName(), '', {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });

  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  
  // Clear the HTTP-only session cookie and redirect
  response.cookies.set(getSessionCookieName(), '', {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });

  return response;
}
