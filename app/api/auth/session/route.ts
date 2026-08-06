import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { getSessionCookieName } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    // 1. Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken, true);
    const uid = decodedToken.uid;

    // 2. Read users/{uid}
    const userDoc = await firestore.collection('users').doc(uid).get();

    // 3. Confirm profile exists
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User profile not found. Access denied.' },
        { status: 404 }
      );
    }

    // 4. Confirm account is active
    const user = userDoc.data();
    if (user?.accountStatus === 'inactive' || user?.isActive === false) {
      return NextResponse.json(
        { error: 'Account is deactivated. Access denied.' },
        { status: 403 }
      );
    }

    // Set session expiration to 5 days
    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn,
    });

    const response = NextResponse.json({ status: 'success' });

    // Set secure HTTP-only cookie
    response.cookies.set(getSessionCookieName(), sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    console.error('Session creation error:', error);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
