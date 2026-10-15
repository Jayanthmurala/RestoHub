import { NextRequest } from 'next/server';
import { getOrders, createOrder } from '@/lib/services/orders';
import { requireAuth, apiError, apiSuccess } from '@/lib/api-helpers';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req);
  if (error) return error;
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');
    const orders = await getOrders(limit);
    return apiSuccess(orders);
  } catch (e: unknown) {
    return apiError((e as Error).message, 500);
  }
}

const createSchema = z.object({
  table_id: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(req);
  if (error || !session) return error!;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.message);
    const userId = parseInt((session.user as { id?: string }).id ?? '0');
    const order = await createOrder(parsed.data.table_id, userId);
    return apiSuccess(order, 201);
  } catch (e: unknown) {
    return apiError((e as Error).message, 500);
  }
}
