import { query, queryOne } from '@/lib/db';
import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'waiter' | 'manager';
}

export async function getUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  return queryOne<User & { password_hash: string }>(
    `SELECT id, name, email, role, password_hash FROM users WHERE email = $1`,
    [email]
  );
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUser(id: number): Promise<User | null> {
  return queryOne<User>(`SELECT id, name, email, role FROM users WHERE id = $1`, [id]);
}
