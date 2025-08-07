# MongoDB to Neon PostgreSQL Migration Guide

## Overview
This guide provides a step-by-step process to migrate the PMO Playbook application from MongoDB to Neon PostgreSQL with JSONB support. Each phase includes testing checkpoints to ensure everything works correctly before proceeding.

## Current State Analysis

### MongoDB Collections to Migrate
- [ ] `projects` - Project management data
- [ ] `human_sops` - Human-readable Standard Operating Procedures
- [ ] `agent_sops` - AI-structured SOPs for agent consumption
- [ ] `chat_histories` - Chat conversation logs
- [ ] `user_feedback` - User feedback entries
- [ ] `message_feedback` - Message-specific feedback
- [ ] `change_proposals` - SOP change proposals  
- [ ] `sop_version_histories` - SOP version tracking
- [ ] `users` - User accounts

### Files Requiring Updates
- 14 API route files in `/src/app/api/`
- 9 Model files in `/src/models/`
- Database connection module `/src/lib/mongodb.ts`
- Various script files in `/scripts/`

---

## PHASE 1: PostgreSQL Setup & Connection
**Objective:** Set up PostgreSQL client and create parallel connection infrastructure

### Steps

#### 1.1 Install PostgreSQL Dependencies
```bash
npm install @neondatabase/serverless
npm install --save-dev @types/pg
```

#### 1.2 Create PostgreSQL Connection Module
Create `/src/lib/postgres.ts`:

```typescript
import { Pool } from '@neondatabase/serverless';

let pool: Pool | undefined;

export function getPostgresPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    
    pool = new Pool({
      connectionString,
      ssl: true,
    });
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
```

#### 1.3 Create Database Test Script
Create `/scripts/test-postgres-connection.ts`:

```typescript
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
```

### Testing Checkpoint 1 ✓

Run these commands and verify output:

```bash
# Test PostgreSQL connection
npm run test-postgres

# Expected output:
# ✅ PostgreSQL connected successfully
# Database: neondb
# ✅ Test table created successfully
# ✅ JSONB insert successful
# ✅ JSONB query successful
# ✅ Cleanup successful
```

**Before proceeding to Phase 2:**
- [ ] PostgreSQL connection works
- [ ] JSONB operations are successful
- [ ] No errors in test script
- [ ] Environment variables are correctly configured

---

## PHASE 2: Create PostgreSQL Schema & Models
**Objective:** Design and implement PostgreSQL schema with JSONB columns

### Steps

#### 2.1 Create Schema Migration Script
Create `/scripts/create-postgres-schema.ts`:

```typescript
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
        phase INTEGER NOT NULL CHECK (phase >= 1 AND phase <= 5),
        data JSONB NOT NULL,
        version INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_human_sops_sop_id ON human_sops(sop_id);
      CREATE INDEX IF NOT EXISTS idx_human_sops_phase ON human_sops(phase);
      CREATE INDEX IF NOT EXISTS idx_human_sops_data ON human_sops USING GIN(data);
    `);
    console.log('✅ Human SOPs table created');
    
    // Agent SOPs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_sops (
        id SERIAL PRIMARY KEY,
        sop_id VARCHAR(10) UNIQUE NOT NULL CHECK (sop_id ~ '^SOP-[0-9]{3}$'),
        human_sop_id INTEGER REFERENCES human_sops(id),
        phase INTEGER NOT NULL CHECK (phase >= 1 AND phase <= 5),
        data JSONB NOT NULL,
        searchable_content TEXT,
        version INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_agent_sops_sop_id ON agent_sops(sop_id);
      CREATE INDEX IF NOT EXISTS idx_agent_sops_phase ON agent_sops(phase);
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
```

#### 2.2 Create PostgreSQL Model Base Class
Create `/src/lib/postgres-model.ts`:

```typescript
import { Pool } from '@neondatabase/serverless';
import { getPostgresPool } from './postgres';

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
```

#### 2.3 Update package.json Scripts
Add these scripts to your package.json:

```json
{
  "scripts": {
    "test-postgres": "tsx scripts/test-postgres-connection.ts",
    "create-schema": "tsx scripts/create-postgres-schema.ts",
    "drop-schema": "tsx scripts/drop-postgres-schema.ts"
  }
}
```

### Testing Checkpoint 2 ✓

Run these commands and verify:

```bash
# Create the PostgreSQL schema
npm run create-schema

# Expected output:
# ✅ Projects table created
# ✅ Human SOPs table created
# ✅ Agent SOPs table created
# ✅ Chat histories table created
# ✅ User feedback table created
# ✅ Message feedback table created
# ✅ Change proposals table created
# ✅ SOP version histories table created
# ✅ Users table created
# ✅ Update triggers created
# ✅ All PostgreSQL tables created successfully!
```

Verify tables exist:
```bash
# Create a verification script
echo "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" | npx tsx -e "
import { getPostgresPool } from './src/lib/postgres';
const pool = getPostgresPool();
pool.query(process.stdin.toString()).then(r => console.log(r.rows))
"
```

**Before proceeding to Phase 3:**
- [ ] All 9 tables created successfully
- [ ] Indexes are in place
- [ ] Triggers are created
- [ ] No errors during schema creation

---

## PHASE 3: Data Migration Scripts
**Objective:** Migrate existing data from MongoDB to PostgreSQL

### Steps

#### 3.1 Create Data Export Script
Create `/scripts/export-mongodb-data.ts`:

```typescript
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { connectToDatabase } from '../src/lib/mongodb';
import mongoose from 'mongoose';

async function exportData() {
  try {
    console.log('Connecting to MongoDB...');
    await connectToDatabase();
    
    const exportDir = path.join(__dirname, '..', 'data-export');
    await fs.mkdir(exportDir, { recursive: true });
    
    const collections = [
      'projects',
      'human_sops',
      'agent_sops',
      'chat_histories',
      'user_feedback',
      'message_feedback',
      'change_proposals',
      'sop_version_histories',
      'users'
    ];
    
    for (const collectionName of collections) {
      console.log(`Exporting ${collectionName}...`);
      const collection = mongoose.connection.db.collection(collectionName);
      const documents = await collection.find({}).toArray();
      
      const filePath = path.join(exportDir, `${collectionName}.json`);
      await fs.writeFile(filePath, JSON.stringify(documents, null, 2));
      console.log(`✅ Exported ${documents.length} documents from ${collectionName}`);
    }
    
    console.log('\n✅ All data exported successfully!');
    console.log(`Data saved to: ${exportDir}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportData();
```

#### 3.2 Create Data Import Script
Create `/scripts/import-to-postgres.ts`:

```typescript
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { getPostgresPool } from '../src/lib/postgres';

async function importData() {
  const pool = getPostgresPool();
  
  try {
    console.log('Starting PostgreSQL import...');
    const exportDir = path.join(__dirname, '..', 'data-export');
    
    // Import Projects
    const projectsFile = path.join(exportDir, 'projects.json');
    if (await fs.access(projectsFile).then(() => true).catch(() => false)) {
      const projects = JSON.parse(await fs.readFile(projectsFile, 'utf-8'));
      console.log(`Importing ${projects.length} projects...`);
      
      for (const project of projects) {
        const { _id, projectId, isActive, createdAt, updatedAt, ...data } = project;
        await pool.query(`
          INSERT INTO projects (project_id, data, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (project_id) DO UPDATE SET
            data = EXCLUDED.data,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at
        `, [
          projectId,
          JSON.stringify({ ...data, _id }),
          isActive ?? true,
          new Date(createdAt || Date.now()),
          new Date(updatedAt || Date.now())
        ]);
      }
      console.log('✅ Projects imported');
    }
    
    // Import Human SOPs
    const humanSopsFile = path.join(exportDir, 'human_sops.json');
    if (await fs.access(humanSopsFile).then(() => true).catch(() => false)) {
      const humanSops = JSON.parse(await fs.readFile(humanSopsFile, 'utf-8'));
      console.log(`Importing ${humanSops.length} human SOPs...`);
      
      for (const sop of humanSops) {
        const { _id, sopId, phase, version, isActive, createdAt, updatedAt, ...data } = sop;
        await pool.query(`
          INSERT INTO human_sops (sop_id, phase, data, version, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (sop_id) DO UPDATE SET
            phase = EXCLUDED.phase,
            data = EXCLUDED.data,
            version = EXCLUDED.version,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at
        `, [
          sopId,
          phase,
          JSON.stringify({ ...data, _id }),
          version || 1,
          isActive ?? true,
          new Date(createdAt || Date.now()),
          new Date(updatedAt || Date.now())
        ]);
      }
      console.log('✅ Human SOPs imported');
    }
    
    // Import Agent SOPs
    const agentSopsFile = path.join(exportDir, 'agent_sops.json');
    if (await fs.access(agentSopsFile).then(() => true).catch(() => false)) {
      const agentSops = JSON.parse(await fs.readFile(agentSopsFile, 'utf-8'));
      console.log(`Importing ${agentSops.length} agent SOPs...`);
      
      for (const sop of agentSops) {
        const { 
          _id, sopId, humanSopId, phase, searchableContent, 
          version, isActive, lastSyncedAt, createdAt, updatedAt, ...data 
        } = sop;
        
        // Find corresponding human_sop_id in PostgreSQL
        let pgHumanSopId = null;
        if (humanSopId) {
          const result = await pool.query(
            `SELECT id FROM human_sops WHERE data->>'_id' = $1`,
            [humanSopId.toString()]
          );
          pgHumanSopId = result.rows[0]?.id;
        }
        
        await pool.query(`
          INSERT INTO agent_sops (
            sop_id, human_sop_id, phase, data, searchable_content, 
            version, is_active, last_synced_at, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (sop_id) DO UPDATE SET
            human_sop_id = EXCLUDED.human_sop_id,
            phase = EXCLUDED.phase,
            data = EXCLUDED.data,
            searchable_content = EXCLUDED.searchable_content,
            version = EXCLUDED.version,
            is_active = EXCLUDED.is_active,
            last_synced_at = EXCLUDED.last_synced_at,
            updated_at = EXCLUDED.updated_at
        `, [
          sopId,
          pgHumanSopId,
          phase,
          JSON.stringify({ ...data, _id, humanSopId }),
          searchableContent || '',
          version || 1,
          isActive ?? true,
          new Date(lastSyncedAt || Date.now()),
          new Date(createdAt || Date.now()),
          new Date(updatedAt || Date.now())
        ]);
      }
      console.log('✅ Agent SOPs imported');
    }
    
    // Import Chat Histories
    const chatHistoriesFile = path.join(exportDir, 'chat_histories.json');
    if (await fs.access(chatHistoriesFile).then(() => true).catch(() => false)) {
      const chatHistories = JSON.parse(await fs.readFile(chatHistoriesFile, 'utf-8'));
      console.log(`Importing ${chatHistories.length} chat histories...`);
      
      for (const chat of chatHistories) {
        const { 
          _id, sessionId, userId, status, startedAt, 
          endedAt, lastActive, createdAt, updatedAt, ...data 
        } = chat;
        
        await pool.query(`
          INSERT INTO chat_histories (
            session_id, user_id, data, status, started_at, 
            ended_at, last_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (session_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            data = EXCLUDED.data,
            status = EXCLUDED.status,
            ended_at = EXCLUDED.ended_at,
            last_active = EXCLUDED.last_active,
            updated_at = EXCLUDED.updated_at
        `, [
          sessionId,
          userId || null,
          JSON.stringify({ ...data, _id }),
          status || 'active',
          new Date(startedAt || Date.now()),
          endedAt ? new Date(endedAt) : null,
          new Date(lastActive || Date.now()),
          new Date(createdAt || Date.now()),
          new Date(updatedAt || Date.now())
        ]);
      }
      console.log('✅ Chat histories imported');
    }
    
    // Import remaining collections...
    // (Similar pattern for user_feedback, message_feedback, change_proposals, sop_version_histories, users)
    
    console.log('\n✅ All data imported successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importData();
```

#### 3.3 Create Data Verification Script
Create `/scripts/verify-postgres-data.ts`:

```typescript
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { getPostgresPool } from '../src/lib/postgres';
import { connectToDatabase } from '../src/lib/mongodb';
import mongoose from 'mongoose';

async function verifyMigration() {
  const pool = getPostgresPool();
  
  try {
    console.log('Verifying data migration...\n');
    
    // Connect to MongoDB for comparison
    await connectToDatabase();
    
    const collections = [
      { mongo: 'projects', postgres: 'projects', keyField: 'project_id' },
      { mongo: 'human_sops', postgres: 'human_sops', keyField: 'sop_id' },
      { mongo: 'agent_sops', postgres: 'agent_sops', keyField: 'sop_id' },
      { mongo: 'chat_histories', postgres: 'chat_histories', keyField: 'session_id' },
    ];
    
    for (const { mongo, postgres, keyField } of collections) {
      // Count documents in MongoDB
      const mongoCollection = mongoose.connection.db.collection(mongo);
      const mongoCount = await mongoCollection.countDocuments();
      
      // Count rows in PostgreSQL
      const pgResult = await pool.query(`SELECT COUNT(*) FROM ${postgres}`);
      const pgCount = parseInt(pgResult.rows[0].count);
      
      console.log(`${mongo}:`);
      console.log(`  MongoDB: ${mongoCount} documents`);
      console.log(`  PostgreSQL: ${pgCount} rows`);
      
      if (mongoCount === pgCount) {
        console.log(`  ✅ Counts match!`);
      } else {
        console.log(`  ⚠️  Count mismatch!`);
      }
      
      // Sample data verification
      const mongoSample = await mongoCollection.findOne({});
      if (mongoSample) {
        const keyValue = mongoSample[keyField === 'project_id' ? 'projectId' : 
                                    keyField === 'sop_id' ? 'sopId' : 
                                    keyField === 'session_id' ? 'sessionId' : keyField];
        
        const pgSample = await pool.query(
          `SELECT * FROM ${postgres} WHERE ${keyField} = $1`,
          [keyValue]
        );
        
        if (pgSample.rows.length > 0) {
          console.log(`  ✅ Sample document found in both databases`);
        } else {
          console.log(`  ⚠️  Sample document not found in PostgreSQL`);
        }
      }
      console.log('');
    }
    
    console.log('✅ Verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyMigration();
```

### Testing Checkpoint 3 ✓

Run these commands in sequence:

```bash
# 1. Export data from MongoDB
npm run export-data

# 2. Import data to PostgreSQL
npm run import-data

# 3. Verify the migration
npm run verify-migration

# Expected output:
# projects:
#   MongoDB: X documents
#   PostgreSQL: X rows
#   ✅ Counts match!
#   ✅ Sample document found in both databases
# ... (similar for other collections)
```

**Before proceeding to Phase 4:**
- [ ] All data exported from MongoDB successfully
- [ ] All data imported to PostgreSQL successfully
- [ ] Document counts match between databases
- [ ] Sample queries work correctly
- [ ] JSONB data is accessible

---

## PHASE 4: Update API Routes
**Objective:** Replace MongoDB operations with PostgreSQL in API routes

### Steps

#### 4.1 Create PostgreSQL Model Implementations
Create `/src/models/postgres/Project.ts`:

```typescript
import { PostgresModel } from '@/lib/postgres-model';

export interface ProjectData {
  projectName: string;
  sponsor: string;
  projectTeam: string[];
  keyStakeholders: string[];
  projectObjectives: string[];
  businessCaseSummary: string;
  resourceRequirements: string;
  scopeDeliverables: string[];
  keyDatesMilestones: Array<{ date: Date; description: string }>;
  threats: string[];
  opportunities: string[];
  keyAssumptions: string[];
  successCriteria: string[];
  createdBy?: string;
  lastModifiedBy?: string;
}

export class ProjectModel extends PostgresModel {
  constructor() {
    super('projects');
  }
  
  async findByProjectId(projectId: string) {
    const result = await this.findOne({ project_id: projectId });
    if (result) {
      return {
        id: result.id,
        projectId: result.project_id,
        ...result.data,
        isActive: result.is_active,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }
    return null;
  }
  
  async getActiveProjects() {
    const results = await this.findMany(
      { is_active: true },
      { orderBy: 'project_id ASC' }
    );
    return results.map(row => ({
      id: row.id,
      projectId: row.project_id,
      ...row.data,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  
  async createProject(projectId: string, data: ProjectData) {
    const result = await this.create({
      project_id: projectId,
      data: JSON.stringify(data),
      is_active: true
    });
    return {
      id: result.id,
      projectId: result.project_id,
      ...data,
      isActive: result.is_active,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }
  
  async updateProject(projectId: string, updates: Partial<ProjectData>) {
    const existing = await this.findOne({ project_id: projectId });
    if (!existing) return null;
    
    const mergedData = { ...existing.data, ...updates };
    const results = await this.update(
      { project_id: projectId },
      { data: JSON.stringify(mergedData) }
    );
    
    if (results.length > 0) {
      const result = results[0];
      return {
        id: result.id,
        projectId: result.project_id,
        ...result.data,
        isActive: result.is_active,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }
    return null;
  }
  
  async getNextProjectId() {
    const result = await this.pool.query(`
      SELECT project_id FROM projects 
      ORDER BY project_id DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return 'PRO-001';
    }
    
    const lastId = result.rows[0].project_id;
    const lastNumber = parseInt(lastId.split('-')[1]);
    const nextNumber = lastNumber + 1;
    return `PRO-${nextNumber.toString().padStart(3, '0')}`;
  }
}

export const Project = new ProjectModel();
```

#### 4.2 Update API Route to Use PostgreSQL
Update `/src/app/api/projects/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { Project } from '@/models/postgres/Project';

// GET all projects
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';
    
    const projects = activeOnly 
      ? await Project.getActiveProjects()
      : await Project.findMany();
    
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST create new project
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Get next project ID
    const projectId = await Project.getNextProjectId();
    
    // Create project
    const project = await Project.createProject(projectId, body);
    
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
```

#### 4.3 Create Migration Toggle
Create `/src/lib/database-config.ts`:

```typescript
// This file allows gradual migration from MongoDB to PostgreSQL
export const DATABASE_CONFIG = {
  // Set to 'postgres' when ready to switch
  projects: process.env.USE_POSTGRES_PROJECTS === 'true' ? 'postgres' : 'mongodb',
  humanSops: process.env.USE_POSTGRES_SOPS === 'true' ? 'postgres' : 'mongodb',
  agentSops: process.env.USE_POSTGRES_SOPS === 'true' ? 'postgres' : 'mongodb',
  chatHistories: process.env.USE_POSTGRES_CHAT === 'true' ? 'postgres' : 'mongodb',
  userFeedback: process.env.USE_POSTGRES_FEEDBACK === 'true' ? 'postgres' : 'mongodb',
  messageFeedback: process.env.USE_POSTGRES_FEEDBACK === 'true' ? 'postgres' : 'mongodb',
  changeProposals: process.env.USE_POSTGRES_PROPOSALS === 'true' ? 'postgres' : 'mongodb',
  sopVersionHistories: process.env.USE_POSTGRES_SOPS === 'true' ? 'postgres' : 'mongodb',
  users: process.env.USE_POSTGRES_USERS === 'true' ? 'postgres' : 'mongodb',
};
```

### Testing Checkpoint 4 ✓

Test the API routes with PostgreSQL:

```bash
# Add to .env.local
echo "USE_POSTGRES_PROJECTS=true" >> .env.local

# Start the dev server
npm run dev

# Test the API endpoints
curl http://localhost:3000/api/projects

# Create a test project
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "Test Project",
    "sponsor": "Test Sponsor",
    "businessCaseSummary": "Test summary",
    "resourceRequirements": "Test requirements"
  }'
```

**Before proceeding to Phase 5:**
- [ ] API routes work with PostgreSQL
- [ ] Data is correctly saved and retrieved
- [ ] No errors in console
- [ ] Frontend still functions correctly

---

## PHASE 5: Complete Transition
**Objective:** Switch all operations to PostgreSQL and ensure system stability

### Steps

#### 5.1 Update All API Routes
Repeat the pattern from Phase 4 for all API routes:

- [ ] `/api/projects/*` - Projects API
- [ ] `/api/content-db/*` - Human SOPs API
- [ ] `/api/files-db/*` - Agent SOPs API
- [ ] `/api/chat/*` - Chat API
- [ ] `/api/chat-history/*` - Chat History API
- [ ] `/api/sessions/*` - Sessions API
- [ ] `/api/user-feedback/*` - User Feedback API
- [ ] `/api/message-feedback/*` - Message Feedback API
- [ ] `/api/proposals/*` - Change Proposals API
- [ ] `/api/sops/regenerate/*` - SOP Regeneration API

#### 5.2 Update Environment Variables
Update `.env.local`:

```bash
# Enable PostgreSQL for all modules
USE_POSTGRES_PROJECTS=true
USE_POSTGRES_SOPS=true
USE_POSTGRES_CHAT=true
USE_POSTGRES_FEEDBACK=true
USE_POSTGRES_PROPOSALS=true
USE_POSTGRES_USERS=true

# Comment out MongoDB URI (keep for backup)
# MONGODB_URI=mongodb+srv://...
```

#### 5.3 Run Full System Test
Create `/scripts/test-full-system.ts`:

```typescript
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testSystem() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('Testing full system with PostgreSQL...\n');
  
  const tests = [
    { name: 'Projects API', url: '/api/projects' },
    { name: 'Human SOPs API', url: '/api/content-db' },
    { name: 'Agent SOPs API', url: '/api/files-db' },
    { name: 'Sessions API', url: '/api/sessions' },
  ];
  
  for (const test of tests) {
    try {
      const response = await fetch(`${baseUrl}${test.url}`);
      if (response.ok) {
        console.log(`✅ ${test.name}: OK`);
      } else {
        console.log(`❌ ${test.name}: Failed (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}`);
    }
  }
  
  console.log('\n✅ System test complete!');
}

testSystem();
```

### Testing Checkpoint 5 ✓

Run comprehensive tests:

```bash
# Start the application
npm run dev

# In another terminal, run system tests
npm run test-system

# Test the UI manually
# - Create a new project
# - View SOPs
# - Use the chat interface
# - Submit feedback
```

**Before proceeding to Phase 6:**
- [ ] All API endpoints work with PostgreSQL
- [ ] UI functions correctly
- [ ] No MongoDB errors in console
- [ ] Data operations are successful

---

## PHASE 6: Cleanup & Optimization
**Objective:** Remove MongoDB code and optimize PostgreSQL implementation

### Steps

#### 6.1 Remove MongoDB Dependencies
```bash
# Remove MongoDB packages
npm uninstall mongodb mongoose

# Remove MongoDB connection file
rm src/lib/mongodb.ts

# Remove old MongoDB models
rm -rf src/models/*.ts
mv src/models/postgres/* src/models/
rm -rf src/models/postgres
```

#### 6.2 Clean Up Scripts
Update `/scripts/` directory:
- Remove MongoDB-specific scripts
- Update remaining scripts to use PostgreSQL

#### 6.3 Performance Optimization
Add additional indexes based on query patterns:

```sql
-- Add full-text search indexes
CREATE INDEX idx_projects_search ON projects USING GIN(to_tsvector('english', data->>'projectName' || ' ' || data->>'businessCaseSummary'));

-- Add composite indexes for common queries
CREATE INDEX idx_chat_histories_user_status ON chat_histories(user_id, status);
CREATE INDEX idx_feedback_session_created ON user_feedback(session_id, created_at DESC);
```

#### 6.4 Create Backup Script
Create `/scripts/backup-postgres.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(__dirname, '..', 'backups', `backup-${timestamp}.sql`);
  
  const command = `pg_dump ${process.env.DATABASE_URL} > ${backupFile}`;
  
  try {
    await execAsync(command);
    console.log(`✅ Backup created: ${backupFile}`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
  }
}

backupDatabase();
```

### Final Testing Checkpoint ✓

Run final verification:

```bash
# Run all tests
npm run test

# Check for any MongoDB references
grep -r "mongodb\|mongoose" src/ --exclude-dir=node_modules

# Verify all features work
# - Projects CRUD
# - SOPs viewing and editing
# - Chat functionality
# - Feedback submission
# - Admin panels
```

**Migration Complete Checklist:**
- [ ] All data migrated successfully
- [ ] All features working with PostgreSQL
- [ ] MongoDB dependencies removed
- [ ] No MongoDB references in code
- [ ] Performance is acceptable
- [ ] Backup procedures in place

---

## Rollback Procedures

If issues arise at any phase, use these rollback steps:

### Phase 1-2 Rollback
```bash
# Drop PostgreSQL tables
npm run drop-schema

# Remove PostgreSQL files
rm src/lib/postgres.ts
rm src/lib/postgres-model.ts
```

### Phase 3-4 Rollback
```bash
# Revert to MongoDB in .env.local
USE_POSTGRES_PROJECTS=false
USE_POSTGRES_SOPS=false
# ... etc

# Restart application
npm run dev
```

### Phase 5-6 Rollback
```bash
# Restore MongoDB connection
git checkout src/lib/mongodb.ts

# Reinstall MongoDB packages
npm install mongodb mongoose

# Restore MongoDB models
git checkout src/models/

# Update .env.local to use MongoDB
```

---

## Troubleshooting

### Common Issues and Solutions

1. **Connection Issues**
   - Verify DATABASE_URL in .env.local
   - Check Neon dashboard for connection limits
   - Ensure SSL is enabled

2. **JSONB Query Issues**
   - Use `data->>'field'` for text extraction
   - Use `data->'field'` for JSON extraction
   - Use `data @> '{"field": "value"}'` for containment

3. **Performance Issues**
   - Add appropriate indexes
   - Use connection pooling
   - Optimize JSONB queries

4. **Migration Data Mismatch**
   - Verify MongoDB export completed
   - Check for data transformation errors
   - Compare specific documents

---

## Success Criteria

The migration is complete when:
1. ✅ All data is migrated from MongoDB to PostgreSQL
2. ✅ All application features work with PostgreSQL
3. ✅ MongoDB code and dependencies are removed
4. ✅ Performance meets or exceeds MongoDB baseline
5. ✅ Backup and recovery procedures are in place
6. ✅ Documentation is updated

---

## Notes

- Keep MongoDB connection details for reference (commented out)
- Maintain data export files until confident in migration
- Consider running both databases in parallel for a transition period
- Monitor application logs closely after migration
- Document any custom queries or patterns discovered during migration