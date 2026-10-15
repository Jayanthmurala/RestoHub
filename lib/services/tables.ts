import { query, queryOne } from '@/lib/db';

export type TableStatus = 'available' | 'occupied' | 'reserved';

export interface Table {
  id: number;
  name: string;
  capacity: number;
  status: TableStatus;
  current_order_id?: number | null;
  current_order_number?: string | null;
}

export async function getTables(): Promise<Table[]> {
  return query<Table>(`
    SELECT t.id, t.name, t.capacity, t.status,
           o.id as current_order_id, o.order_number as current_order_number
    FROM tables t
    LEFT JOIN orders o ON o.table_id = t.id AND o.status NOT IN ('paid', 'cancelled')
    ORDER BY t.id
  `);
}

export async function getTable(id: number): Promise<Table | null> {
  return queryOne<Table>(`
    SELECT t.id, t.name, t.capacity, t.status,
           o.id as current_order_id, o.order_number as current_order_number
    FROM tables t
    LEFT JOIN orders o ON o.table_id = t.id AND o.status NOT IN ('paid', 'cancelled')
    WHERE t.id = $1
  `, [id]);
}

export async function updateTableStatus(id: number, status: TableStatus): Promise<Table | null> {
  return queryOne<Table>(`
    UPDATE tables SET status = $2 WHERE id = $1 RETURNING *
  `, [id, status]);
}
