import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { getPostgresPool } from '../src/lib/postgres';

async function createSchema() {
  const pool = getPostgresPool();
  
  try {
    console.log('Creating PostgreSQL schema...');
    
    // Projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(10) UNIQUE NOT NULL CHECK (project_id ~ '^PRO-[0-9]{3}$'),
        data JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_projects_project_id ON projects(project_id);
      CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active);
      CREATE INDEX IF NOT EXISTS idx_projects_data ON projects USING GIN(data);
    `);
    console.log('✅ Projects table created');
    
    // Human SOPs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS human_sops (
        id SERIAL PRIMARY KEY,
        sop_id VARCHAR(10) UNIQUE NOT NULL CHECK (sop_id ~ '^SOP-[0-9]{3}$'),
        data JSONB NOT NULL,
        version INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_human_sops_sop_id ON human_sops(sop_id);
      CREATE INDEX IF NOT EXISTS idx_human_sops_data ON human_sops USING GIN(data);
    `);
    console.log('✅ Human SOPs table created');
    
    // Agent SOPs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_sops (
        id SERIAL PRIMARY KEY,
        sop_id VARCHAR(10) UNIQUE NOT NULL CHECK (sop_id ~ '^SOP-[0-9]{3}$'),
        human_sop_id INTEGER REFERENCES human_sops(id),
        data JSONB NOT NULL,
        searchable_content TEXT,
        version INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_agent_sops_sop_id ON agent_sops(sop_id);
      CREATE INDEX IF NOT EXISTS idx_agent_sops_data ON agent_sops USING GIN(data);
      CREATE INDEX IF NOT EXISTS idx_agent_sops_search ON agent_sops USING GIN(to_tsvector('english', searchable_content));
    `);
    console.log('✅ Agent SOPs table created');
    
    // Chat histories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_histories (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100) UNIQUE NOT NULL,
        user_id VARCHAR(100),
        data JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_chat_histories_session_id ON chat_histories(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_histories_user_id ON chat_histories(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_histories_status ON chat_histories(status);
      CREATE INDEX IF NOT EXISTS idx_chat_histories_data ON chat_histories USING GIN(data);
    `);
    console.log('✅ Chat histories table created');
    
    // User feedback table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_feedback (
        id SERIAL PRIMARY KEY,
        feedback_id VARCHAR(50) UNIQUE NOT NULL,
        session_id VARCHAR(100),
        data JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_user_feedback_session_id ON user_feedback(session_id);
      CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);
      CREATE INDEX IF NOT EXISTS idx_user_feedback_data ON user_feedback USING GIN(data);
    `);
    console.log('✅ User feedback table created');
    
    // Message feedback table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_feedback (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(100) UNIQUE NOT NULL,
        session_id VARCHAR(100),
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_message_feedback_session_id ON message_feedback(session_id);
      CREATE INDEX IF NOT EXISTS idx_message_feedback_data ON message_feedback USING GIN(data);
    `);
    console.log('✅ Message feedback table created');
    
    // Change proposals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS change_proposals (
        id SERIAL PRIMARY KEY,
        proposal_id VARCHAR(50) UNIQUE NOT NULL,
        sop_id VARCHAR(10) NOT NULL,
        data JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_change_proposals_sop_id ON change_proposals(sop_id);
      CREATE INDEX IF NOT EXISTS idx_change_proposals_status ON change_proposals(status);
      CREATE INDEX IF NOT EXISTS idx_change_proposals_data ON change_proposals USING GIN(data);
    `);
    console.log('✅ Change proposals table created');
    
    // SOP version histories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sop_version_histories (
        id SERIAL PRIMARY KEY,
        sop_id VARCHAR(10) NOT NULL,
        version INTEGER NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sop_id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_sop_version_histories_sop_id ON sop_version_histories(sop_id);
      CREATE INDEX IF NOT EXISTS idx_sop_version_histories_data ON sop_version_histories USING GIN(data);
    `);
    console.log('✅ SOP version histories table created');
    
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        data JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_data ON users USING GIN(data);
    `);
    console.log('✅ Users table created');
    
    // Create update trigger for updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    const tables = [
      'projects', 'human_sops', 'agent_sops', 'chat_histories',
      'user_feedback', 'message_feedback', 'change_proposals',
      'sop_version_histories', 'users'
    ];
    
    for (const table of tables) {
      await pool.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at 
        BEFORE UPDATE ON ${table} 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
      `);
    }
    console.log('✅ Update triggers created');
    
    console.log('\n✅ All PostgreSQL tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Schema creation failed:', error);
    process.exit(1);
  }
}

createSchema();