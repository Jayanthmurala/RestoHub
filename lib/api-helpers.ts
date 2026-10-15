import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function requireAuth(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };
  }
  return { error: null, session };
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
