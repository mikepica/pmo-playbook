import { Pool as NeonPool } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';

type Pool = NeonPool | PgPool;

// Database connection management
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

// Base model class with database operations
export class PostgresModel {
  protected pool: Pool;
  protected tableName: string;
  
  constructor(tableName: string) {
    this.pool = getPostgresPool();
    this.tableName = tableName;
  }
  
  async findOne(conditions: Record<string, any>) {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    
    const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }
  
  async findMany(conditions: Record<string, any> = {}, options: { limit?: number; offset?: number; orderBy?: string } = {}) {
    let query = `SELECT * FROM ${this.tableName}`;
    const values: any[] = [];
    
    if (Object.keys(conditions).length > 0) {
      const keys = Object.keys(conditions);
      const whereClause = keys.map((key, i) => {
        values.push(conditions[key]);
        return `${key} = $${values.length}`;
      }).join(' AND ');
      query += ` WHERE ${whereClause}`;
    }
    
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }
    
    const result = await this.pool.query(query, values);
    return result.rows;
  }
  
  async create(data: Record<string, any>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
  
  async update(conditions: Record<string, any>, updates: Record<string, any>) {
    const updateKeys = Object.keys(updates);
    const updateValues = Object.values(updates);
    const conditionKeys = Object.keys(conditions);
    const conditionValues = Object.values(conditions);
    
    const setClause = updateKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const whereClause = conditionKeys.map((key, i) => `${key} = $${updateValues.length + i + 1}`).join(' AND ');
    
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [...updateValues, ...conditionValues]);
    return result.rows;
  }
  
  async delete(conditions: Record<string, any>) {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    
    const query = `DELETE FROM ${this.tableName} WHERE ${whereClause} RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows;
  }
}