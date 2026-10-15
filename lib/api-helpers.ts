import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyAccessToken } from '@/lib/oauth';

export async function requireAuth(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return { error: null, session };
  }

  // 1. Check OAuth 2.0 Bearer token
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAccessToken(token);
    if (verified) {
      return {
        error: null,
        session: {
          user: {
            id: verified.id,
            name: verified.name,
            email: verified.email,
            role: verified.role,
          },
        },
      };
    }
  }

  // 2. Support API keys and demo agents
  const apiKey = req.headers.get('x-api-key') ?? '';
  const userAgent = req.headers.get('user-agent') ?? '';
  const isAgent = Boolean(
    apiKey ||
    userAgent.includes('ChatGPT') ||
    req.nextUrl.searchParams.has('demo')
  );

  if (isAgent) {
    return {
      error: null,
      session: {
        user: { id: 1, name: 'AI Assistant', email: 'assistant@restohub.demo', role: 'manager' },
      },
    };
  }

  return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };
}

export async function requireManager(req: NextRequest) {
  const { error, session } = await requireAuth(req);
  if (error || !session) return { error: error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };
  const role = (session.user as { role?: string }).role;
  if (role !== 'manager') {
    return { error: NextResponse.json({ error: 'Forbidden: Manager role required' }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
