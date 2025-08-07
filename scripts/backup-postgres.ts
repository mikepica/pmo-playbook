import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

async function backupDatabase() {
  try {
    console.log('🔄 Creating PostgreSQL backup...\n');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupDir = path.join(__dirname, '..', 'backups');
    
    // Ensure backup directory exists
    try {
      await fs.mkdir(backupDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const backupFile = path.join(backupDir, `pmo-playbook-${timestamp}.sql`);
    const schemaFile = path.join(backupDir, `pmo-playbook-schema-${timestamp}.sql`);
    
    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable not set');
    }
    
    console.log('📦 Creating full database backup...');
    // Full database backup
    const backupCommand = `pg_dump "${databaseUrl}" > "${backupFile}"`;
    await execAsync(backupCommand);
    console.log(`   ✅ Full backup saved: ${backupFile}`);
    
    console.log('📋 Creating schema-only backup...');
    // Schema-only backup
    const schemaCommand = `pg_dump "${databaseUrl}" --schema-only > "${schemaFile}"`;
    await execAsync(schemaCommand);
    console.log(`   ✅ Schema backup saved: ${schemaFile}`);
    
    // Get backup file sizes
    const fullStats = await fs.stat(backupFile);
    const schemaStats = await fs.stat(schemaFile);
    
    console.log('\n📊 Backup Summary:');
    console.log(`   Full backup: ${(fullStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Schema backup: ${(schemaStats.size / 1024).toFixed(2)} KB`);
    
    // Create data-only export (JSON format for easy reading)
    console.log('\n📄 Creating JSON data export...');
    
    const { getPostgresPool } = await import('../src/lib/postgres');
    const pool = getPostgresPool();
    
    const tables = [
      'projects', 'human_sops', 'agent_sops', 'chat_histories',
      'user_feedback', 'message_feedback', 'change_proposals',
      'sop_version_histories', 'users'
    ];
    
    const dataExport: Record<string, any[]> = {};
    
    for (const table of tables) {
      const result = await pool.query(`SELECT * FROM ${table} ORDER BY created_at`);
      dataExport[table] = result.rows;
      console.log(`   ✅ Exported ${result.rows.length} rows from ${table}`);
    }
    
    const jsonFile = path.join(backupDir, `pmo-playbook-data-${timestamp}.json`);
    await fs.writeFile(jsonFile, JSON.stringify(dataExport, null, 2));
    const jsonStats = await fs.stat(jsonFile);
    console.log(`   ✅ JSON export saved: ${jsonFile} (${(jsonStats.size / 1024).toFixed(2)} KB)`);
    
    // Create backup metadata
    const metadataFile = path.join(backupDir, `backup-${timestamp}-metadata.json`);
    const metadata = {
      timestamp: new Date().toISOString(),
      database: 'pmo-playbook',
      tables: tables.length,
      totalRecords: Object.values(dataExport).reduce((sum, records) => sum + records.length, 0),
      files: {
        full: path.basename(backupFile),
        schema: path.basename(schemaFile),
        data: path.basename(jsonFile)
      },
      sizes: {
        full: `${(fullStats.size / 1024 / 1024).toFixed(2)} MB`,
        schema: `${(schemaStats.size / 1024).toFixed(2)} KB`,
        data: `${(jsonStats.size / 1024).toFixed(2)} KB`
      }
    };
    
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`   ✅ Metadata saved: ${metadataFile}`);
    
    console.log('\n🎉 Backup completed successfully!');
    console.log('\n💡 Files created:');
    console.log(`   📁 ${backupDir}/`);
    console.log(`   ├── ${path.basename(backupFile)} (Full SQL backup)`);
    console.log(`   ├── ${path.basename(schemaFile)} (Schema only)`);
    console.log(`   ├── ${path.basename(jsonFile)} (JSON data export)`);
    console.log(`   └── ${path.basename(metadataFile)} (Backup metadata)`);
    
    console.log('\n💡 To restore:');
    console.log(`   psql "${databaseUrl}" < "${backupFile}"`);
    
    return {
      backupFile,
      schemaFile,  
      jsonFile,
      metadataFile
    };
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

if (require.main === module) {
  backupDatabase().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export { backupDatabase };