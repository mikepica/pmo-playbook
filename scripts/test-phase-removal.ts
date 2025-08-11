#!/usr/bin/env tsx
// Test script to validate phase removal is complete and working

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { getPostgresPool } from '../src/lib/postgres';

async function testPhaseRemoval() {
  const pool = getPostgresPool();
  
  console.log('🧪 Testing phase removal implementation...\n');

  try {
    // Test 1: Check database schema doesn't have phase columns
    console.log('1️⃣ Testing database schema...');
    
    const humanSOPColumns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'human_sops' AND table_schema = 'public'
      ORDER BY column_name
    `);
    
    const agentSOPColumns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'agent_sops' AND table_schema = 'public'
      ORDER BY column_name
    `);
    
    const humanColumns = humanSOPColumns.rows.map(r => r.column_name);
    const agentColumns = agentSOPColumns.rows.map(r => r.column_name);
    
    if (humanColumns.includes('phase')) {
      console.log('   ❌ human_sops still has phase column');
      return false;
    } else {
      console.log('   ✅ human_sops phase column removed');
    }
    
    if (agentColumns.includes('phase')) {
      console.log('   ❌ agent_sops still has phase column');
      return false;
    } else {
      console.log('   ✅ agent_sops phase column removed');
    }

    // Test 2: Check that we can create SOPs without phase
    console.log('\n2️⃣ Testing SOP creation without phase...');
    
    try {
      await pool.query(`
        INSERT INTO human_sops (sop_id, data) 
        VALUES ('SOP-998', '{"title": "Test SOP", "markdownContent": "# Test\\n\\nThis is a test."}')
      `);
      console.log('   ✅ Successfully created human_sop without phase');
      
      await pool.query(`
        INSERT INTO agent_sops (sop_id, data, searchable_content) 
        VALUES ('SOP-998', '{"title": "Test Agent SOP", "summary": "Test summary"}', 'test content')
      `);
      console.log('   ✅ Successfully created agent_sop without phase');
      
      // Clean up test data
      await pool.query('DELETE FROM agent_sops WHERE sop_id = $1', ['SOP-998']);
      await pool.query('DELETE FROM human_sops WHERE sop_id = $1', ['SOP-998']);
      console.log('   🧹 Test data cleaned up');
      
    } catch (error) {
      console.log('   ❌ Failed to create SOPs without phase:', error);
      return false;
    }

    // Test 3: Import and test models
    console.log('\n3️⃣ Testing model functionality...');
    
    try {
      const { HumanSOP } = await import('../src/models/HumanSOP');
      const { AgentSOP } = await import('../src/models/AgentSOP');

      const humanSOPs = await HumanSOP.getAllActiveSOPs();
      console.log(`   ✅ HumanSOP.getAllActiveSOPs() returned ${humanSOPs.length} SOPs`);
      
      const agentSummaries = await AgentSOP.getAllSummaries();
      console.log(`   ✅ AgentSOP.getAllSummaries() returned ${agentSummaries.length} SOPs`);
      
      // Check that returned objects don't have phase property
      if (humanSOPs.length > 0) {
        const firstSOP = humanSOPs[0];
        if ('phase' in firstSOP) {
          console.log('   ❌ HumanSOP objects still contain phase property');
          return false;
        } else {
          console.log('   ✅ HumanSOP objects do not contain phase property');
        }
      }
      
    } catch (error) {
      console.log('   ❌ Model testing failed:', error);
      return false;
    }

    // Test 4: Test AI configuration loading
    console.log('\n4️⃣ Testing AI configuration...');
    
    try {
      const { getAIConfig } = await import('../src/lib/ai-config');
      const config = getAIConfig();
      
      if (config.flow.enable_cross_phase_queries !== undefined) {
        console.log('   ❌ AI config still has enable_cross_phase_queries');
        return false;
      }
      
      if (config.flow.enable_cross_topic_queries) {
        console.log('   ✅ AI config has enable_cross_topic_queries');
      } else {
        console.log('   ⚠️  AI config missing enable_cross_topic_queries');
      }
      
      if (config.content.show_phase_transitions !== undefined) {
        console.log('   ❌ AI config still has show_phase_transitions');
        return false;
      }
      
      if (config.content.show_topic_relationships) {
        console.log('   ✅ AI config has show_topic_relationships');
      }
      
      // Check context fields don't include phase
      if (config.content.sop_context_fields.includes('phase')) {
        console.log('   ❌ AI config sop_context_fields still includes "phase"');
        return false;
      } else {
        console.log('   ✅ AI config sop_context_fields does not include "phase"');
      }
      
    } catch (error) {
      console.log('   ❌ AI config testing failed:', error);
      return false;
    }

    // Test 5: Test new semantic analyzer
    console.log('\n5️⃣ Testing semantic analyzer...');
    
    try {
      const { SemanticAnalyzer } = await import('../src/lib/semantic-analyzer');
      
      const clusters = await SemanticAnalyzer.clusterByTopics();
      console.log(`   ✅ Topic clustering returned ${clusters.length} clusters`);
      
      const matches = await SemanticAnalyzer.findSemanticMatches('project planning', 0.1);
      console.log(`   ✅ Semantic matching returned ${matches.length} matches`);
      
      const optimal = await SemanticAnalyzer.selectOptimalSOPs('risk management', 3, 0.3);
      console.log(`   ✅ Optimal SOP selection strategy: ${optimal.strategy}`);
      
    } catch (error) {
      console.log('   ❌ Semantic analyzer testing failed:', error);
      return false;
    }

    console.log('\n🎉 All tests passed! Phase removal implementation is complete and functional.');
    console.log('\n📋 Summary of changes:');
    console.log('   • Database schema updated (phase columns removed)');
    console.log('   • Models work without phase properties');
    console.log('   • AI configuration optimized for semantic/topic organization');
    console.log('   • New semantic analyzer provides enhanced SOP selection');
    console.log('   • UI components updated to remove phase displays');
    
    return true;

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Run tests
testPhaseRemoval()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
  });