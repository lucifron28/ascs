import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookieName } from './lib/auth/session-name';
import { verifyFirebaseSessionCookie } from './lib/auth/edge-session';

function decodeDevelopmentJwt(token: string) {
  /* DEVELOPMENT ONLY: Unverified JWT decode for local Firebase Auth emulator */
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
  const sessionCookieName = getSessionCookieName();
  const session = request.cookies.get(sessionCookieName)?.value;
  const url = request.nextUrl.clone();

  const isAuthRoute = url.pathname.startsWith('/login');
  const isApiRoute = url.pathname.startsWith('/api/');
  const isPublicRoute = url.pathname === '/' || isAuthRoute || isApiRoute;

  // No session cookie, redirect protected routes to login
  if (!session) {
    if (!isPublicRoute) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let role = 'student';
  let mustChangePassword = false;

  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    /* DEVELOPMENT ONLY: Unverified JWT decode for local Firebase Auth emulator */
    const devPayload = decodeDevelopmentJwt(session);
    role = (devPayload?.role as string) || 'student';
    mustChangePassword = devPayload?.mustChangePassword === true;
  } else {
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ascs11';
      const verifiedPayload = await verifyFirebaseSessionCookie(session, projectId);
      role = verifiedPayload.role || 'student';
      mustChangePassword = verifiedPayload.mustChangePassword === true;
    } catch (verifyError: unknown) {
      const message = verifyError instanceof Error ? verifyError.message : 'Session verification error';
      console.error('Middleware session verification failed:', message);

      if (isApiRoute) {
        const apiRes = NextResponse.json(
          { error: 'Unauthorized: Session verification failed.' },
          { status: 401 }
        );
        apiRes.cookies.delete(sessionCookieName);
        return apiRes;
      }

      url.pathname = '/login';
      const redirectRes = NextResponse.redirect(url);
      redirectRes.cookies.delete(sessionCookieName);
      return redirectRes;
    }
  }
  // 1. Mandatory password change routing enforcement
  if (mustChangePassword) {
    const isAllowedPasswordChangePath =
      url.pathname === '/change-password' ||
      url.pathname === '/api/auth/change-password' ||
      url.pathname === '/api/auth/logout' ||
      url.pathname === '/api/auth/profile' ||
      url.pathname === '/api/auth/session';

    if (!isAllowedPasswordChangePath) {
      url.pathname = '/change-password';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 2. If password change is complete, prevent access to /change-password
  if (url.pathname === '/change-password') {
    url.pathname = `/${role}/dashboard`;
    return NextResponse.redirect(url);
  }

  // 3. Redirect logged-in users away from login page
  if (isAuthRoute) {
    url.pathname = `/${role}/dashboard`;
    return NextResponse.redirect(url);
  }

  // 4. Guard role-specific paths
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
