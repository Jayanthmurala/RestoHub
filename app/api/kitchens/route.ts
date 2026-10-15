import { NextRequest } from 'next/server';
import { getKitchens } from '@/lib/services/kitchens';
import { requireAuth, apiError, apiSuccess } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req);
  if (error) return error;
  try {
    const kitchens = await getKitchens();
    return apiSuccess(kitchens);
  } catch (e: unknown) {
    return apiError((e as Error).message, 500);
  }
}
