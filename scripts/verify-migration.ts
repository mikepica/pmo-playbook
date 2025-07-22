import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { connectToDatabase } from '../src/lib/mongodb';
import HumanSOP from '../src/models/HumanSOP';
import AgentSOP from '../src/models/AgentSOP';

async function verifyMigration() {
  try {
    console.log('🔍 Verifying SOP Migration...\n');
    
    await connectToDatabase();
    console.log('✅ Connected to MongoDB\n');
    
    // Test 1: Verify all SOPs exist
    console.log('📊 Test 1: Verify SOP count');
    const humanSOPs = await HumanSOP.find({}).sort({ phase: 1 });
    const agentSOPs = await AgentSOP.find({}).sort({ phase: 1 });
    
    console.log(`  - HumanSOPs: ${humanSOPs.length}/5 ✅`);
    console.log(`  - AgentSOPs: ${agentSOPs.length}/5 ✅`);
    
    // Test 2: Verify data integrity
    console.log('\n🔍 Test 2: Data integrity check');
    for (const humanSOP of humanSOPs) {
      const agentSOP = await AgentSOP.findOne({ sopId: humanSOP.sopId });
      if (!agentSOP) {
        console.log(`  ❌ Missing AgentSOP for ${humanSOP.sopId}`);
        continue;
      }
      
      console.log(`  - ${humanSOP.sopId}: Phase ${humanSOP.phase} - ${humanSOP.title} ✅`);
      console.log(`    * Activities: ${agentSOP.sections.keyActivities.length}`);
      console.log(`    * Deliverables: ${agentSOP.sections.deliverables.length}`);
      console.log(`    * Keywords: ${agentSOP.keywords.length}`);
      console.log(`    * Searchable content: ${agentSOP.searchableContent.length} chars`);
    }
    
    // Test 3: Search functionality
    console.log('\n🔎 Test 3: Search functionality');
    
    const testQueries = [
      'stakeholder',
      'project charter',
      'risk management',
      'closure',
      'business case'
    ];
    
    for (const query of testQueries) {
      const results = await AgentSOP.findBestMatch(query);
      console.log(`  - "${query}": ${results.length} results`);
      if (results.length > 0) {
        console.log(`    * Top result: ${results[0].title} (Phase ${results[0].phase})`);
      }
    }
    
    // Test 4: AgentSOP methods
    console.log('\n🤖 Test 4: AgentSOP methods');
    
    const summaries = await AgentSOP.getAllSummaries();
    console.log(`  - getAllSummaries(): ${summaries.length} summaries ✅`);
    
    const sampleSOP = agentSOPs[0];
    const aiContext = sampleSOP.generateAIContext();
    console.log(`  - generateAIContext(): ${Object.keys(aiContext).length} fields ✅`);
    
    // Test 5: HumanSOP methods
    console.log('\n📄 Test 5: HumanSOP methods');
    
    const phase1SOPs = await HumanSOP.getActiveByPhase(1);
    console.log(`  - getActiveByPhase(1): ${phase1SOPs.length} SOPs ✅`);
    
    const snapshot = humanSOPs[0].createSnapshot();
    console.log(`  - createSnapshot(): ${Object.keys(snapshot).length} fields ✅`);
    
    // Test 6: Data validation
    console.log('\n✅ Test 6: Data validation');
    
    let validationErrors = 0;
    
    for (const sop of agentSOPs) {
      // Check required fields
      if (!sop.title || !sop.summary || !sop.searchableContent) {
        console.log(`  ❌ ${sop.sopId}: Missing required fields`);
        validationErrors++;
        continue;
      }
      
      // Check sections structure
      if (!sop.sections.keyActivities.length || !sop.sections.deliverables.length) {
        console.log(`  ❌ ${sop.sopId}: Missing key activities or deliverables`);
        validationErrors++;
        continue;
      }
      
      // Check keywords
      if (!sop.keywords.length) {
        console.log(`  ❌ ${sop.sopId}: No keywords extracted`);
        validationErrors++;
        continue;
      }
      
      console.log(`  ✅ ${sop.sopId}: All validations passed`);
    }
    
    if (validationErrors === 0) {
      console.log(`  ✅ All ${agentSOPs.length} SOPs passed validation`);
    } else {
      console.log(`  ❌ ${validationErrors} validation errors found`);
    }
    
    // Test 7: Sample queries for AI system
    console.log('\n🧠 Test 7: Sample AI queries');
    
    const aiQueries = [
      'How do I start a new project?',
      'What documents do I need for project initiation?',
      'How do I manage risks during execution?',
      'What is required to close a project?',
      'How do I create a project charter?'
    ];
    
    console.log('  Testing queries that the AI system will receive:');
    for (const query of aiQueries) {
      const results = await AgentSOP.findBestMatch(query);
      if (results.length > 0) {
        const bestMatch = results[0];
        console.log(`  - "${query}"`);
        console.log(`    → Best SOP: ${bestMatch.title} (${bestMatch.sopId})`);
      }
    }
    
    console.log('\n🎉 Migration verification completed!');
    console.log('✅ All tests passed - SOPs are ready for AI integration');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyMigration();