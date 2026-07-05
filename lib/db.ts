import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  
  // Prevent build-time crashes when DATABASE_URL is not set
  if (!connectionString) {
    return new Pool();
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  return pool;
}

export async function query(text: string, params?: any[]) {
  const db = getDbPool();
  try {
    return await db.query(text, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}
