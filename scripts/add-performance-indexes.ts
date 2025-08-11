import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { getPostgresPool } from '../src/lib/postgres';

async function addPerformanceOptimizations() {
  const pool = getPostgresPool();
  
  try {
    console.log('🚀 Adding performance optimizations...\n');
    
    // Add full-text search indexes
    console.log('📊 Adding full-text search indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_search 
      ON projects USING GIN(to_tsvector('english', data->>'projectName' || ' ' || data->>'businessCaseSummary'))
    `);
    console.log('   ✅ Projects full-text search index');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_human_sops_search 
      ON human_sops USING GIN(to_tsvector('english', data->>'title' || ' ' || data->>'markdownContent'))
    `);
    console.log('   ✅ Human SOPs full-text search index');
    
    // Add composite indexes for common queries
    console.log('\n📊 Adding composite indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_histories_user_status 
      ON chat_histories(user_id, status) WHERE status = 'active'
    `);
    console.log('   ✅ Chat histories user+status index');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_active_created 
      ON projects(is_active, created_at DESC) WHERE is_active = true
    `);
    console.log('   ✅ Projects active+created index');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sops_active_created 
      ON human_sops(is_active, created_at DESC) WHERE is_active = true
    `);
    console.log('   ✅ SOPs active+created index');
    
    // Add JSONB path indexes for frequently accessed fields
    console.log('\n📊 Adding JSONB path indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_sponsor 
      ON projects USING BTREE((data->>'sponsor')) WHERE is_active = true
    `);
    console.log('   ✅ Projects sponsor index');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_created 
      ON chat_histories(started_at DESC) WHERE status = 'active'
    `);
    console.log('   ✅ Chat sessions created index');
    
    // Analyze tables for better query planning
    console.log('\n📊 Updating table statistics...');
    const tables = [
      'projects', 'human_sops', 'agent_sops', 'chat_histories',
      'user_feedback', 'message_feedback', 'change_proposals',
      'sop_version_histories', 'users'
    ];
    
    for (const table of tables) {
      await pool.query(`ANALYZE ${table}`);
      console.log(`   ✅ Analyzed ${table}`);
    }
    
    // Create materialized view for SOP usage statistics
    console.log('\n📊 Creating materialized views...');
    await pool.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS sop_usage_stats AS
      SELECT 
        usage_item->>'sopId' as sop_id,
        COUNT(DISTINCT ch.session_id) as unique_sessions,
        SUM((usage_item->>'usageCount')::int) as total_usage,
        MAX((usage_item->>'lastUsed')::timestamp) as last_used,
        AVG((usage_item->>'usageCount')::int) as avg_usage_per_session
      FROM chat_histories ch,
           jsonb_array_elements(ch.data->'sopUsage') as usage_item
      WHERE ch.started_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY usage_item->>'sopId'
      ORDER BY total_usage DESC
    `);
    console.log('   ✅ SOP usage statistics materialized view');
    
    // Create function to refresh materialized views
    await pool.query(`
      CREATE OR REPLACE FUNCTION refresh_sop_usage_stats()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW sop_usage_stats;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ Materialized view refresh function');
    
    // Set up connection pooling parameters
    console.log('\n📊 Optimizing connection settings...');
    await pool.query(`SET work_mem = '4MB'`);
    await pool.query(`SET shared_preload_libraries = 'pg_stat_statements'`);
    console.log('   ✅ Connection parameters optimized');
    
    console.log('\n🎉 Performance optimizations completed successfully!');
    console.log('\n💡 Recommendations:');
    console.log('   - Run ANALYZE on tables after bulk data changes');
    console.log('   - Refresh materialized views weekly: SELECT refresh_sop_usage_stats();');
    console.log('   - Monitor slow queries with pg_stat_statements');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Performance optimization failed:', error);
    process.exit(1);
  }
}

addPerformanceOptimizations();