import { NextResponse } from 'next/server';
import { getSessionCookie, getAuthenticatedUser } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSessionCookie();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    let authResult;
    try {
      authResult = await getAuthenticatedUser(session);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unauthorized';
      const isNotFound = message.includes('not found');
      return NextResponse.json(
        { error: message },
        { status: isNotFound ? 404 : 401 }
      );
    }

    return NextResponse.json({ profile: authResult.user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Profile API error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
