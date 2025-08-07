import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { getPostgresPool } from '../src/lib/postgres';

async function verifySchema() {
  const pool = getPostgresPool();
  
  try {
    console.log('Verifying PostgreSQL schema...\n');
    
    // Check tables exist
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const expectedTables = [
      'agent_sops',
      'change_proposals', 
      'chat_histories',
      'human_sops',
      'message_feedback',
      'projects',
      'sop_version_histories',
      'user_feedback',
      'users'
    ];
    
    console.log('📋 Tables:');
    const actualTables = tablesResult.rows.map(row => row.table_name);
    for (const table of expectedTables) {
      if (actualTables.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - MISSING`);
      }
    }
    
    // Check indexes
    const indexesResult = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname
    `);
    
    console.log('\n📊 Indexes:');
    let currentTable = '';
    for (const row of indexesResult.rows) {
      if (row.tablename !== currentTable) {
        console.log(`  ${row.tablename}:`);
        currentTable = row.tablename;
      }
      console.log(`    ✅ ${row.indexname}`);
    }
    
    // Test JSONB operations on each table
    console.log('\n🧪 Testing JSONB operations:');
    
    // Test projects table
    await pool.query(`
      INSERT INTO projects (project_id, data) 
      VALUES ('PRO-999', '{"test": "data", "nested": {"key": "value"}}')
    `);
    const projectTest = await pool.query(`
      SELECT data->>'test' as test_value FROM projects WHERE project_id = 'PRO-999'
    `);
    console.log(`  ✅ Projects JSONB: ${projectTest.rows[0]?.test_value}`);
    
    // Test human_sops table
    await pool.query(`
      INSERT INTO human_sops (sop_id, phase, data) 
      VALUES ('SOP-999', 1, '{"title": "Test SOP", "content": "Test content"}')
    `);
    const sopTest = await pool.query(`
      SELECT data->>'title' as title FROM human_sops WHERE sop_id = 'SOP-999'
    `);
    console.log(`  ✅ Human SOPs JSONB: ${sopTest.rows[0]?.title}`);
    
    // Clean up test data
    await pool.query('DELETE FROM projects WHERE project_id = $1', ['PRO-999']);
    await pool.query('DELETE FROM human_sops WHERE sop_id = $1', ['SOP-999']);
    
    // Check triggers
    console.log('\n⚡ Testing update triggers:');
    await pool.query(`
      INSERT INTO projects (project_id, data) 
      VALUES ('PRO-998', '{"test": "trigger"}')
    `);
    
    const beforeUpdate = await pool.query(`
      SELECT updated_at FROM projects WHERE project_id = 'PRO-998'
    `);
    
    // Wait a moment then update
    await new Promise(resolve => setTimeout(resolve, 100));
    await pool.query(`
      UPDATE projects SET data = '{"test": "updated"}' WHERE project_id = 'PRO-998'
    `);
    
    const afterUpdate = await pool.query(`
      SELECT updated_at FROM projects WHERE project_id = 'PRO-998'
    `);
    
    if (afterUpdate.rows[0].updated_at > beforeUpdate.rows[0].updated_at) {
      console.log('  ✅ Update trigger working');
    } else {
      console.log('  ❌ Update trigger not working');
    }
    
    // Clean up
    await pool.query('DELETE FROM projects WHERE project_id = $1', ['PRO-998']);
    
    console.log('\n✅ Schema verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Schema verification failed:', error);
    process.exit(1);
  }
}

verifySchema();