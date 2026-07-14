import { NextRequest, NextResponse } from 'next/server';
import { CSRF_COOKIE_NAME } from '@/lib/csrf';
import { revokeToken } from '@/lib/token-blacklist';

export async function POST(request: NextRequest) {
  // Extract token from cookie and add to the persisted revocation list. Every
  // authenticated /api/* request consults the same store via getAuthPayload,
  // so this token can't be replayed even within its remaining 8h JWT life.
  const token = request.cookies.get('tamamhealth-token')?.value;
  if (token) {
    await revokeToken(token);
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set('tamamhealth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  // Clear the CSRF cookie too so the next sign-in mints a fresh, session-bound
  // token. Leaving the old one around would let an attacker who scraped it
  // pair it with a future session of the same user.
  response.cookies.set(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return response;
}
