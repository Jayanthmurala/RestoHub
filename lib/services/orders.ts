import { query, queryOne } from '@/lib/db';
import { updateTableStatus } from './tables';

export type OrderStatus = 'draft' | 'submitted' | 'preparing' | 'ready' | 'paid' | 'cancelled';

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  quantity: number;
  unit_price: number;
  name: string;
  category: string;
}

export interface Order {
  id: number;
  order_number: string;
  table_id: number;
  table_name: string;
  user_id: number;
  user_name: string;
  status: OrderStatus;
  discount_pct: number;
  notes: string;
  kitchen_id: number | null;
  kitchen_name: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  items: OrderItem[];
  created_at: string;
  submitted_at: string | null;
}

export interface OrderSummary {
  id: number;
  order_number: string;
  table_id: number;
  table_name: string;
  user_name: string;
  status: OrderStatus;
  discount_pct: number;
  kitchen_id: number | null;
  kitchen_name: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  item_count: number;
  created_at: string;
  submitted_at: string | null;
}

async function generateOrderNumber(): Promise<string> {
  const rows = await query<{ count: string }>(`SELECT COUNT(*) as count FROM orders`);
  const n = parseInt(rows[0].count) + 1;
  return `ORD-${String(n).padStart(4, '0')}`;
}

export async function getOrders(limit = 50): Promise<OrderSummary[]> {
  return query<OrderSummary>(`
    SELECT 
      o.id, o.order_number, o.table_id, t.name as table_name,
      u.name as user_name, o.status, o.discount_pct, o.notes,
      o.kitchen_id, k.name as kitchen_name,
      o.created_at, o.submitted_at,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) as subtotal,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) * o.discount_pct / 100 as discount_amount,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) * (1 - o.discount_pct / 100) as total,
      COUNT(oi.id) as item_count
    FROM orders o
    JOIN tables t ON t.id = o.table_id
    JOIN users u ON u.id = o.user_id
    LEFT JOIN kitchens k ON k.id = o.kitchen_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id, t.name, u.name, k.name
    ORDER BY o.created_at DESC
    LIMIT $1
  `, [limit]);
}

export async function getOrder(id: number): Promise<Order | null> {
  const rows = await query<Omit<Order, 'items'>>(`
    SELECT 
      o.id, o.order_number, o.table_id, t.name as table_name,
      o.user_id, u.name as user_name, o.status, o.discount_pct, o.notes,
      o.kitchen_id, k.name as kitchen_name,
      o.created_at, o.submitted_at,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) as subtotal,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) * o.discount_pct / 100 as discount_amount,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) * (1 - o.discount_pct / 100) as total
    FROM orders o
    JOIN tables t ON t.id = o.table_id
    JOIN users u ON u.id = o.user_id
    LEFT JOIN kitchens k ON k.id = o.kitchen_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = $1
    GROUP BY o.id, t.name, u.name, k.name
  `, [id]);
  
  if (!rows[0]) return null;
  
  const items = await query<OrderItem>(`
    SELECT oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.unit_price,
           m.name, m.category
    FROM order_items oi
    JOIN menu_items m ON m.id = oi.menu_item_id
    WHERE oi.order_id = $1
    ORDER BY oi.id
  `, [id]);
  
  return { ...rows[0], items };
}

export async function createOrder(tableId: number, userId: number): Promise<Order> {
  const orderNumber = await generateOrderNumber();
  const row = await queryOne<{ id: number }>(`
    INSERT INTO orders (order_number, table_id, user_id, status, discount_pct, notes)
    VALUES ($1, $2, $3, 'draft', 0, '')
    RETURNING id
  `, [orderNumber, tableId, userId]);
  
  await updateTableStatus(tableId, 'occupied');
  return getOrder(row!.id) as Promise<Order>;
}

export async function addOrderItems(
  orderId: number,
  items: Array<{ menu_item_id: number; quantity: number; unit_price: number }>
): Promise<Order> {
  for (const item of items) {
    // Upsert: if item exists, update quantity; otherwise insert
    await query(`
      INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (order_id, menu_item_id)
      DO UPDATE SET quantity = order_items.quantity + EXCLUDED.quantity
    `, [orderId, item.menu_item_id, item.quantity, item.unit_price]);
  }
  return getOrder(orderId) as Promise<Order>;
}

export async function setOrderItems(
  orderId: number,
  items: Array<{ menu_item_id: number; quantity: number; unit_price: number }>
): Promise<Order> {
  await query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
  for (const item of items) {
    if (item.quantity > 0) {
      await query(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price)
        VALUES ($1, $2, $3, $4)
      `, [orderId, item.menu_item_id, item.quantity, item.unit_price]);
    }
  }
  return getOrder(orderId) as Promise<Order>;
}

export async function applyDiscount(orderId: number, pct: number): Promise<Order> {
  if (pct < 0 || pct > 100) throw new Error('Discount must be between 0 and 100');
  await query(`UPDATE orders SET discount_pct = $2 WHERE id = $1`, [orderId, pct]);
  return getOrder(orderId) as Promise<Order>;
}

export async function assignKitchen(orderId: number, kitchenId: number): Promise<Order> {
  await query(`UPDATE orders SET kitchen_id = $2 WHERE id = $1`, [orderId, kitchenId]);
  return getOrder(orderId) as Promise<Order>;
}

export async function updateOrderNotes(orderId: number, notes: string): Promise<Order> {
  await query(`UPDATE orders SET notes = $2 WHERE id = $1`, [orderId, notes]);
  return getOrder(orderId) as Promise<Order>;
}

export async function submitOrder(orderId: number): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'draft') throw new Error('Only draft orders can be submitted');
  if (!order.kitchen_id) throw new Error('Please assign a kitchen before submitting');
  if (order.items.length === 0) throw new Error('Order has no items');
  
  await query(`
    UPDATE orders SET status = 'submitted', submitted_at = NOW() WHERE id = $1
  `, [orderId]);
  return getOrder(orderId) as Promise<Order>;
}

export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order> {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['paid'],
    paid: [],
    cancelled: [],
  };
  
  const order = await getOrder(orderId);
  if (!order) throw new Error('Order not found');
  
  if (!validTransitions[order.status].includes(status)) {
    throw new Error(`Cannot transition from ${order.status} to ${status}`);
  }
  
  await query(`UPDATE orders SET status = $2 WHERE id = $1`, [orderId, status]);
  
  if (status === 'paid' || status === 'cancelled') {
    await updateTableStatus(order.table_id, 'available');
  }
  
  return getOrder(orderId) as Promise<Order>;
}

export async function getKitchenOrders(): Promise<Order[]> {
  const rows = await query<Omit<Order, 'items'>>(`
    SELECT 
      o.id, o.order_number, o.table_id, t.name as table_name,
      o.user_id, u.name as user_name, o.status, o.discount_pct, o.notes,
      o.kitchen_id, k.name as kitchen_name,
      o.created_at, o.submitted_at,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) as subtotal,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) * o.discount_pct / 100 as discount_amount,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) * (1 - o.discount_pct / 100) as total
    FROM orders o
    JOIN tables t ON t.id = o.table_id
    JOIN users u ON u.id = o.user_id
    LEFT JOIN kitchens k ON k.id = o.kitchen_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status IN ('submitted', 'preparing', 'ready')
    GROUP BY o.id, t.name, u.name, k.name
    ORDER BY o.submitted_at ASC
  `);
  
  const orders: Order[] = [];
  for (const row of rows) {
    const items = await query<OrderItem>(`
      SELECT oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.unit_price,
             m.name, m.category
      FROM order_items oi
      JOIN menu_items m ON m.id = oi.menu_item_id
      WHERE oi.order_id = $1
      ORDER BY oi.id
    `, [row.id]);
    orders.push({ ...row, items });
  }
  return orders;
}
