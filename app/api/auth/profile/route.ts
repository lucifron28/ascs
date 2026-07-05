import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';

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

    // Attempt to query profile from Data Connect database
    try {
      const dbUrl = process.env.FIREBASE_DATA_CONNECT_URL || 'http://127.0.0.1:4000/graphql';
      const dbResponse = await fetch(dbUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetProfile($id: String!) {
              profile(id: $id) {
                id
                email
                username
                fullName
                role
                accountStatus
              }
            }
          `,
          variables: { id: uid },
        }),
      });

      if (dbResponse.ok) {
        const { data, errors } = await dbResponse.json();
        if (data?.profile && !errors) {
          return NextResponse.json({ profile: data.profile });
        }
      }
    } catch (dbError) {
      console.warn('Database connection failed, falling back to email-based role deduction:', dbError);
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
      id: uid,
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
