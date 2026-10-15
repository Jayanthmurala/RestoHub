import { query, queryOne } from '@/lib/db';

export interface Kitchen {
  id: number;
  name: string;
  description: string;
}

export async function getKitchens(): Promise<Kitchen[]> {
  return query<Kitchen>(`SELECT * FROM kitchens ORDER BY id`);
}

export async function getKitchen(id: number): Promise<Kitchen | null> {
  return queryOne<Kitchen>(`SELECT * FROM kitchens WHERE id = $1`, [id]);
}
