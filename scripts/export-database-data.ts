import { connectToPostgres } from '../src/lib/postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function exportDatabaseData() {
  console.log('Exporting database data...');
  
  try {
    const pool = await connectToPostgres();
    
    let sqlOutput = `-- PMO Playbook Database Initial Data Import\n`;
    sqlOutput += `-- Generated on ${new Date().toISOString()}\n`;
    sqlOutput += `-- Run this script after creating the schema to populate with existing data\n\n`;
    
    // Define tables to export
    const tables = [
      'projects',
      'human_sops', 
      'agent_sops',
      'chat_histories',
      'change_proposals',
      'user_feedback',
      'message_feedback'
    ];
    
    for (const tableName of tables) {
      console.log(`Exporting data from ${tableName}...`);
      
      // Get all data from table
      const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY id`);
      
      if (result.rows.length > 0) {
        sqlOutput += `-- Insert data into ${tableName}\n`;
        
        for (const row of result.rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (typeof value === 'boolean') return value ? 'true' : 'false';
            if (typeof value === 'object' && value !== null) return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
            if (value instanceof Date) return `'${value.toISOString()}'`;
            return value;
          });
          
          sqlOutput += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        
        sqlOutput += `\n`;
      } else {
        sqlOutput += `-- No data found in ${tableName}\n\n`;
      }
    }
    
    // Add sequence reset commands
    sqlOutput += `-- Reset sequences to continue from current max values\n`;
    for (const tableName of tables) {
      sqlOutput += `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE(MAX(id), 1)) FROM ${tableName};\n`;
    }
    
    // Write to file
    const outputPath = path.join(process.cwd(), 'database-initial-import.sql');
    fs.writeFileSync(outputPath, sqlOutput);
    
    console.log(`✅ Database data exported to: ${outputPath}`);
    console.log(`📊 Export summary:`);
    
    // Print summary
    for (const tableName of tables) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`   - ${tableName}: ${result.rows[0].count} records`);
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportDatabaseData();