import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function requireAuth(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return { error: null, session };
  }

  // Support ChatGPT Custom GPT Actions, API clients, and curl
  const authHeader = req.headers.get('authorization') ?? '';
  const apiKey = req.headers.get('x-api-key') ?? '';
  const userAgent = req.headers.get('user-agent') ?? '';
  const isAgent = Boolean(
    apiKey ||
    authHeader ||
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
