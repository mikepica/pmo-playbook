import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { connectToPostgres } from '../src/lib/postgres';

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...');
    const pool = await connectToPostgres();
    
    // Test basic query
    const result = await pool.query('SELECT current_database(), version()');
    console.log('Database:', result.rows[0].current_database);
    console.log('Version:', result.rows[0].version);
    
    // Test table creation
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migration_test (
        id SERIAL PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Test table created successfully');
    
    // Test JSONB insert
    await pool.query(`
      INSERT INTO migration_test (data) 
      VALUES ($1)
    `, [JSON.stringify({ test: 'data', nested: { value: 123 } })]);
    console.log('✅ JSONB insert successful');
    
    // Test JSONB query
    const jsonResult = await pool.query(`
      SELECT data->>'test' as test_value 
      FROM migration_test 
      LIMIT 1
    `);
    console.log('✅ JSONB query successful:', jsonResult.rows[0]);
    
    // Cleanup
    await pool.query('DROP TABLE migration_test');
    console.log('✅ Cleanup successful');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testConnection();