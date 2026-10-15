import { NextRequest } from 'next/server';
import { getOrder, setOrderItems, applyDiscount, assignKitchen, submitOrder, updateOrderStatus, updateOrderNotes } from '@/lib/services/orders';
import { requireAuth, apiError, apiSuccess } from '@/lib/api-helpers';
import { getMenuItem } from '@/lib/services/menu';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = parseInt(id);
  const order = await getOrder(orderId);
  if (!order) return apiError('Order not found', 404);
  return apiSuccess(order);
}

const itemSchema = z.object({
  items: z.array(z.object({
    menu_item_id: z.number().int().positive(),
    quantity: z.number().int().min(0),
  }))
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth(req);
  if (error) return error;
  
  const { id } = await params;
  const orderId = parseInt(id);
  
  try {
    const body = await req.json();
    const { action } = body;
    
    if (action === 'set_items') {
      const parsed = itemSchema.safeParse(body);
      if (!parsed.success) return apiError(parsed.error.message);
      
      const enrichedItems = [];
      for (const item of parsed.data.items) {
        const menuItem = await getMenuItem(item.menu_item_id);
        if (!menuItem) return apiError(`Menu item ${item.menu_item_id} not found`);
        enrichedItems.push({ menu_item_id: item.menu_item_id, quantity: item.quantity, unit_price: menuItem.price });
      }
      const order = await setOrderItems(orderId, enrichedItems);
      return apiSuccess(order);
    }
    
    if (action === 'apply_discount') {
      const pct = parseFloat(body.discount_pct);
      if (isNaN(pct)) return apiError('Invalid discount percentage');
      const order = await applyDiscount(orderId, pct);
      return apiSuccess(order);
    }
    
    if (action === 'assign_kitchen') {
      const kitchenId = parseInt(body.kitchen_id);
      if (isNaN(kitchenId)) return apiError('Invalid kitchen ID');
      const order = await assignKitchen(orderId, kitchenId);
      return apiSuccess(order);
    }
    
    if (action === 'submit') {
      const order = await submitOrder(orderId);
      return apiSuccess(order);
    }
    
    if (action === 'update_status') {
      const order = await updateOrderStatus(orderId, body.status);
      return apiSuccess(order);
    }
    
    if (action === 'update_notes') {
      const order = await updateOrderNotes(orderId, body.notes ?? '');
      return apiSuccess(order);
    }
    
    return apiError('Unknown action');
  } catch (e: unknown) {
    return apiError((e as Error).message, 400);
  }
}
