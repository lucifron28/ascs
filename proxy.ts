import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Firebase session cookie public keys
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys')
);

function decodeJwt(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const url = request.nextUrl.clone();

  const isAuthRoute = url.pathname.startsWith('/login');
  const isPublicRoute = url.pathname === '/' || isAuthRoute;

  // No session cookie, redirect protected routes to login
  if (!session) {
    if (!isPublicRoute) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Decode JWT payload to extract user metadata/role
  const decoded = decodeJwt(session);
  const role = decoded?.role || 'student';

  // Cryptographically verify session cookie signature in production
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== 'true') {
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ascs11';
      await jwtVerify(session, JWKS, {
        issuer: `https://session.firebase.google.com/${projectId}`,
        audience: projectId,
      });
    } catch (verifyError: any) {
      console.error('Middleware JWT signature verification failed:', verifyError.message);
      if (!isPublicRoute) {
        url.pathname = '/login';
        const redirectRes = NextResponse.redirect(url);
        redirectRes.cookies.delete('session');
        return redirectRes;
      }
    }
  }

  // Redirect logged-in users away from login page
  if (isAuthRoute) {
    url.pathname = `/${role}/dashboard`;
    return NextResponse.redirect(url);
  }

  // Guard role-specific paths
  const rolePrefixes = [
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

  for (const prefix of rolePrefixes) {
    if (url.pathname.startsWith(`/${prefix}`) && role !== prefix) {
      url.pathname = `/${role}/dashboard`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
