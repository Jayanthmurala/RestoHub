import { NextRequest } from 'next/server';
import { getTables } from '@/lib/services/tables';
import { requireAuth, apiError, apiSuccess } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req);
  if (error) return error;
  try {
    const tables = await getTables();
    return apiSuccess(tables);
  } catch (e: unknown) {
    return apiError((e as Error).message, 500);
  }
}
