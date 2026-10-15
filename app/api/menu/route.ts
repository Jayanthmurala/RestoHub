import { NextRequest } from 'next/server';
import { getMenuGrouped, getMenu } from '@/lib/services/menu';
import { requireAuth, apiError, apiSuccess } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req);
  if (error) return error;
  try {
    const grouped = req.nextUrl.searchParams.get('grouped') === 'true';
    const data = grouped ? await getMenuGrouped() : await getMenu();
    return apiSuccess(data);
  } catch (e: unknown) {
    return apiError((e as Error).message, 500);
  }
}
