import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    // Verify session cookie via Admin SDK (fails during build/missing credentials, so try/catch is critical)
    let decodedClaims;
    try {
      decodedClaims = await getAdminAuth().verifySessionCookie(session, true);
    } catch (e: any) {
      console.error('Session verification failed:', e.message);
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
    }

    const uid = decodedClaims.uid;
    const email = decodedClaims.email || '';

    // Attempt to query profile from Firestore database
    try {
      const firestore = getAdminFirestore();
      const userDoc = await firestore.collection('users').doc(uid).get();
      if (userDoc.exists) {
        return NextResponse.json({ profile: userDoc.data() });
      }
    } catch (dbError) {
      console.warn('Firestore database query failed, falling back to email-based role deduction:', dbError);
    }

    // Fallback: Deduce user role from email prefix for easy emulator/demo testing
    let role = 'student';
    const emailLower = email.toLowerCase();

    if (emailLower.includes('admin')) {
      role = 'admin';
    } else if (emailLower.includes('librarian')) {
      role = 'librarian';
    } else if (emailLower.includes('accountant')) {
      role = 'accountant';
    } else if (emailLower.includes('osa')) {
      role = 'osa_coordinator';
    } else if (emailLower.includes('guidance')) {
      role = 'guidance_counselor';
    } else if (emailLower.includes('chair')) {
      role = 'area_chair';
    } else if (emailLower.includes('adviser')) {
      role = 'adviser';
    } else if (emailLower.includes('dean')) {
      role = 'dean';
    }

    const mockProfile = {
      uid: uid,
      email: email,
      username: email.split('@')[0] || 'user',
      fullName: email.split('@')[0]?.toUpperCase() || 'Demo User',
      role: role,
      accountStatus: 'active',
    };

    return NextResponse.json({ profile: mockProfile });
  } catch (error: any) {
    console.error('Profile API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
