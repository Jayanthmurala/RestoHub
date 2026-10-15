import { query } from '@/lib/db';

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  kitchen_id: number;
  kitchen_name: string;
  available: boolean;
  image_url?: string;
}

export interface MenuCategory {
  category: string;
  items: MenuItem[];
}

export async function getMenu(): Promise<MenuItem[]> {
  return query<MenuItem>(`
    SELECT m.id, m.name, m.description, m.price, m.category, m.kitchen_id,
           m.available, m.image_url, k.name as kitchen_name
    FROM menu_items m
    JOIN kitchens k ON k.id = m.kitchen_id
    WHERE m.available = true
    ORDER BY m.category, m.name
  `);
}

export async function getMenuGrouped(): Promise<MenuCategory[]> {
  const items = await getMenu();
  const map: Record<string, MenuItem[]> = {};
  for (const item of items) {
    if (!map[item.category]) map[item.category] = [];
    map[item.category].push(item);
  }
  return Object.entries(map).map(([category, items]) => ({ category, items }));
}

export async function getMenuItem(id: number): Promise<MenuItem | null> {
  const rows = await query<MenuItem>(`
    SELECT m.id, m.name, m.description, m.price, m.category, m.kitchen_id,
           m.available, m.image_url, k.name as kitchen_name
    FROM menu_items m
    JOIN kitchens k ON k.id = m.kitchen_id
    WHERE m.id = $1
  `, [id]);
  return rows[0] ?? null;
}
