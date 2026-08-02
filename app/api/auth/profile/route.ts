import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getSessionCookie, verifySessionCookie } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSessionCookie();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    let decodedClaims;
    try {
      decodedClaims = await verifySessionCookie(session);
    } catch (e: any) {
      console.error('Session verification failed:', e.message);
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
    }

    const uid = decodedClaims.uid;
    const firestore = getAdminFirestore();
    const userDoc = await firestore.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'Profile not found. Contact the system administrator.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ profile: userDoc.data() });
  } catch (error: any) {
    console.error('Profile API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
