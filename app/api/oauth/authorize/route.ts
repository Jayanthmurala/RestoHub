import { NextRequest, NextResponse } from 'next/server';
import { createAuthCode } from '@/lib/oauth';
import { getUserByEmail, verifyPassword } from '@/lib/services/auth';

export async function GET(req: NextRequest) {
  const url = new URL('/oauth/authorize', req.url);
  url.search = req.nextUrl.search;
  return NextResponse.redirect(url);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, redirect_uri } = body;

    let userId = 1; // Default Jayanth Murala (manager)

    if (email && password) {
      const user = await getUserByEmail(email);
      if (!user) {
        return NextResponse.json({ error: 'Invalid user credentials' }, { status: 401 });
      }
      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
      userId = user.id;
    }

    if (!redirect_uri) {
      return NextResponse.json({ error: 'Missing redirect_uri' }, { status: 400 });
    }

    const code = createAuthCode(userId, redirect_uri);
    return NextResponse.json({ code });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
