import { Pool as NeonPool } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';

type Pool = NeonPool | PgPool;

let pool: Pool | undefined;

export function getPostgresPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    
    // Detect if we're using Neon (serverless) or standard PostgreSQL
    const isNeon = connectionString.includes('neon.tech') || process.env.USE_NEON === 'true';
    
    if (isNeon) {
      // Use Neon serverless driver
      pool = new NeonPool({
        connectionString,
        ssl: true,
      });
    } else {
      // Use standard pg driver for local/regular PostgreSQL
      pool = new PgPool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
    }
  }
  
  return pool;
}

export async function connectToPostgres() {
  const pool = getPostgresPool();
  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected successfully');
    return pool;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    throw error;
  }
}