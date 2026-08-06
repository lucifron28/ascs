import { redirect } from 'next/navigation';
import { getSessionCookie } from '@/lib/auth/session';

function decodeJwt(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export default async function Home() {
  const session = await getSessionCookie();

  if (session) {
    const decoded = decodeJwt(session);
    const role = decoded?.role || 'student';
    redirect(`/${role}/dashboard`);
  }

  redirect('/login');
}
