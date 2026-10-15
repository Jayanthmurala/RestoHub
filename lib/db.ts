import { Pool } from 'pg';

// Server-side only — never imported by client components.
// Falls back to hardcoded Neon URL when .env.local is absent.
const NEON_URL =
  process.env.DATABASE_URL ??
  'postgresql://neondb_owner:npg_VTof5LD7OmUX@ep-frosty-lab-a16pu6w4-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require';

const pool = new Pool({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false }, // Neon always requires SSL
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
