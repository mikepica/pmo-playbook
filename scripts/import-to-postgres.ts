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
    
    // Check if export directory exists
    try {
      await fs.access(exportDir);
    } catch {
      console.error(`❌ Export directory not found: ${exportDir}`);
      console.log('Please run "npm run export-data" first');
      process.exit(1);
    }
    
    // Import Projects
    await importProjects(pool, exportDir);
    
    // Import Human SOPs
    await importHumanSOPs(pool, exportDir);
    
    // Import Agent SOPs (depends on Human SOPs)
    await importAgentSOPs(pool, exportDir);
    
    // Import Chat Histories
    await importChatHistories(pool, exportDir);
    
    // Import User Feedback
    await importUserFeedback(pool, exportDir);
    
    // Import Message Feedback
    await importMessageFeedback(pool, exportDir);
    
    // Import Change Proposals
    await importChangeProposals(pool, exportDir);
    
    // Import SOP Version Histories
    await importSOPVersionHistories(pool, exportDir);
    
    // Import Users
    await importUsers(pool, exportDir);
    
    console.log('\n✅ All data imported successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

async function importProjects(pool: any, exportDir: string) {
  const projectsFile = path.join(exportDir, 'projects.json');
  if (!(await fileExists(projectsFile))) {
    console.log('⚠️  No projects.json file found, skipping...');
    return;
  }
  
  const projects = JSON.parse(await fs.readFile(projectsFile, 'utf-8'));
  console.log(`📦 Importing ${projects.length} projects...`);
  
  for (const project of projects) {
    const { _id, projectId, isActive, createdAt, updatedAt, ...data } = project;
    
    try {
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
    } catch (error) {
      console.error(`❌ Failed to import project ${projectId}:`, error.message);
    }
  }
  console.log('   ✅ Projects imported');
}

async function importHumanSOPs(pool: any, exportDir: string) {
  const humanSopsFile = path.join(exportDir, 'human_sops.json');
  if (!(await fileExists(humanSopsFile))) {
    console.log('⚠️  No human_sops.json file found, skipping...');
    return;
  }
  
  const humanSops = JSON.parse(await fs.readFile(humanSopsFile, 'utf-8'));
  console.log(`📦 Importing ${humanSops.length} human SOPs...`);
  
  for (const sop of humanSops) {
    const { _id, sopId, phase, version, isActive, createdAt, updatedAt, ...data } = sop;
    
    try {
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
    } catch (error) {
      console.error(`❌ Failed to import human SOP ${sopId}:`, error.message);
    }
  }
  console.log('   ✅ Human SOPs imported');
}

async function importAgentSOPs(pool: any, exportDir: string) {
  const agentSopsFile = path.join(exportDir, 'agent_sops.json');
  if (!(await fileExists(agentSopsFile))) {
    console.log('⚠️  No agent_sops.json file found, skipping...');
    return;
  }
  
  const agentSops = JSON.parse(await fs.readFile(agentSopsFile, 'utf-8'));
  console.log(`📦 Importing ${agentSops.length} agent SOPs...`);
  
  for (const sop of agentSops) {
    const { 
      _id, sopId, humanSopId, phase, searchableContent, 
      version, isActive, lastSyncedAt, createdAt, updatedAt, ...data 
    } = sop;
    
    // Find corresponding human_sop_id in PostgreSQL
    let pgHumanSopId = null;
    if (humanSopId) {
      try {
        const result = await pool.query(
          `SELECT id FROM human_sops WHERE data->>'_id' = $1`,
          [humanSopId.toString()]
        );
        pgHumanSopId = result.rows[0]?.id;
      } catch (error) {
        console.warn(`⚠️  Could not find human SOP reference for ${sopId}`);
      }
    }
    
    try {
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
    } catch (error) {
      console.error(`❌ Failed to import agent SOP ${sopId}:`, error.message);
    }
  }
  console.log('   ✅ Agent SOPs imported');
}

async function importChatHistories(pool: any, exportDir: string) {
  const chatHistoriesFile = path.join(exportDir, 'chat_histories.json');
  if (!(await fileExists(chatHistoriesFile))) {
    console.log('⚠️  No chat_histories.json file found, skipping...');
    return;
  }
  
  const chatHistories = JSON.parse(await fs.readFile(chatHistoriesFile, 'utf-8'));
  console.log(`📦 Importing ${chatHistories.length} chat histories...`);
  
  for (const chat of chatHistories) {
    const { 
      _id, sessionId, userId, status, startedAt, 
      endedAt, lastActive, createdAt, updatedAt, ...data 
    } = chat;
    
    try {
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
    } catch (error) {
      console.error(`❌ Failed to import chat history ${sessionId}:`, error.message);
    }
  }
  console.log('   ✅ Chat histories imported');
}

async function importUserFeedback(pool: any, exportDir: string) {
  const userFeedbackFile = path.join(exportDir, 'user_feedback.json');
  if (!(await fileExists(userFeedbackFile))) {
    console.log('⚠️  No user_feedback.json file found, skipping...');
    return;
  }
  
  const userFeedback = JSON.parse(await fs.readFile(userFeedbackFile, 'utf-8'));
  console.log(`📦 Importing ${userFeedback.length} user feedback entries...`);
  
  for (const feedback of userFeedback) {
    const { _id, feedbackId, sessionId, status, createdAt, updatedAt, ...data } = feedback;
    
    try {
      await pool.query(`
        INSERT INTO user_feedback (feedback_id, session_id, data, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (feedback_id) DO UPDATE SET
          session_id = EXCLUDED.session_id,
          data = EXCLUDED.data,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `, [
        feedbackId || _id,
        sessionId || null,
        JSON.stringify({ ...data, _id }),
        status || 'new',
        new Date(createdAt || Date.now()),
        new Date(updatedAt || Date.now())
      ]);
    } catch (error) {
      console.error(`❌ Failed to import user feedback ${feedbackId || _id}:`, error.message);
    }
  }
  console.log('   ✅ User feedback imported');
}

async function importMessageFeedback(pool: any, exportDir: string) {
  const messageFeedbackFile = path.join(exportDir, 'message_feedback.json');
  if (!(await fileExists(messageFeedbackFile))) {
    console.log('⚠️  No message_feedback.json file found, skipping...');
    return;
  }
  
  const messageFeedback = JSON.parse(await fs.readFile(messageFeedbackFile, 'utf-8'));
  console.log(`📦 Importing ${messageFeedback.length} message feedback entries...`);
  
  for (const feedback of messageFeedback) {
    const { _id, messageId, sessionId, createdAt, updatedAt, ...data } = feedback;
    
    try {
      await pool.query(`
        INSERT INTO message_feedback (message_id, session_id, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (message_id) DO UPDATE SET
          session_id = EXCLUDED.session_id,
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
      `, [
        messageId || _id,
        sessionId || null,
        JSON.stringify({ ...data, _id }),
        new Date(createdAt || Date.now()),
        new Date(updatedAt || Date.now())
      ]);
    } catch (error) {
      console.error(`❌ Failed to import message feedback ${messageId || _id}:`, error.message);
    }
  }
  console.log('   ✅ Message feedback imported');
}

async function importChangeProposals(pool: any, exportDir: string) {
  const changeProposalsFile = path.join(exportDir, 'change_proposals.json');
  if (!(await fileExists(changeProposalsFile))) {
    console.log('⚠️  No change_proposals.json file found, skipping...');
    return;
  }
  
  const changeProposals = JSON.parse(await fs.readFile(changeProposalsFile, 'utf-8'));
  console.log(`📦 Importing ${changeProposals.length} change proposals...`);
  
  for (const proposal of changeProposals) {
    const { _id, proposalId, sopId, status, createdAt, updatedAt, ...data } = proposal;
    
    try {
      await pool.query(`
        INSERT INTO change_proposals (proposal_id, sop_id, data, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (proposal_id) DO UPDATE SET
          sop_id = EXCLUDED.sop_id,
          data = EXCLUDED.data,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `, [
        proposalId || _id,
        sopId,
        JSON.stringify({ ...data, _id }),
        status || 'pending',
        new Date(createdAt || Date.now()),
        new Date(updatedAt || Date.now())
      ]);
    } catch (error) {
      console.error(`❌ Failed to import change proposal ${proposalId || _id}:`, error.message);
    }
  }
  console.log('   ✅ Change proposals imported');
}

async function importSOPVersionHistories(pool: any, exportDir: string) {
  const sopVersionHistoriesFile = path.join(exportDir, 'sop_version_histories.json');
  if (!(await fileExists(sopVersionHistoriesFile))) {
    console.log('⚠️  No sop_version_histories.json file found, skipping...');
    return;
  }
  
  const sopVersionHistories = JSON.parse(await fs.readFile(sopVersionHistoriesFile, 'utf-8'));
  console.log(`📦 Importing ${sopVersionHistories.length} SOP version histories...`);
  
  for (const version of sopVersionHistories) {
    const { _id, sopId, version: versionNum, createdAt, ...data } = version;
    
    try {
      await pool.query(`
        INSERT INTO sop_version_histories (sop_id, version, data, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sop_id, version) DO UPDATE SET
          data = EXCLUDED.data
      `, [
        sopId,
        versionNum,
        JSON.stringify({ ...data, _id }),
        new Date(createdAt || Date.now())
      ]);
    } catch (error) {
      console.error(`❌ Failed to import SOP version ${sopId} v${versionNum}:`, error.message);
    }
  }
  console.log('   ✅ SOP version histories imported');
}

async function importUsers(pool: any, exportDir: string) {
  const usersFile = path.join(exportDir, 'users.json');
  if (!(await fileExists(usersFile))) {
    console.log('⚠️  No users.json file found, skipping...');
    return;
  }
  
  const users = JSON.parse(await fs.readFile(usersFile, 'utf-8'));
  console.log(`📦 Importing ${users.length} users...`);
  
  for (const user of users) {
    const { _id, userId, email, isActive, lastLogin, createdAt, updatedAt, ...data } = user;
    
    try {
      await pool.query(`
        INSERT INTO users (user_id, email, data, is_active, last_login, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          email = EXCLUDED.email,
          data = EXCLUDED.data,
          is_active = EXCLUDED.is_active,
          last_login = EXCLUDED.last_login,
          updated_at = EXCLUDED.updated_at
      `, [
        userId || email,
        email,
        JSON.stringify({ ...data, _id }),
        isActive ?? true,
        lastLogin ? new Date(lastLogin) : null,
        new Date(createdAt || Date.now()),
        new Date(updatedAt || Date.now())
      ]);
    } catch (error) {
      console.error(`❌ Failed to import user ${userId || email}:`, error.message);
    }
  }
  console.log('   ✅ Users imported');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

importData();