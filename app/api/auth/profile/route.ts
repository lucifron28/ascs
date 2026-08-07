import { NextResponse } from 'next/server';
import { getSessionCookie, getAuthenticatedUserForPasswordChange } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSessionCookie();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    let authResult;
    try {
      authResult = await getAuthenticatedUserForPasswordChange(session);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unauthorized';
      const isNotFound = message.includes('not found');
      const isInactive = message.includes('inactive') || message.includes('deactivated');
      return NextResponse.json(
        { error: message },
        { status: isNotFound ? 404 : isInactive ? 403 : 401 }
      );
    }

    const u = authResult.user;
    const minimalProfile = {
      uid: u.uid || authResult.uid,
      role: u.role || 'student',
      fullName: u.fullName || '',
      accountStatus: u.accountStatus || 'active',
      isActive: u.isActive !== undefined ? Boolean(u.isActive) : u.accountStatus !== 'inactive',
      mustChangePassword: u.mustChangePassword === true,
    };

    return NextResponse.json({ profile: minimalProfile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Profile API error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
