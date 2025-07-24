import { connectToDatabase } from '../src/lib/mongodb';
import HumanSOP from '../src/models/HumanSOP';
import AgentSOP from '../src/models/AgentSOP';
import { regenerateAgentSOP, regenerateAllAgentSOPs, checkRegenerationNeeded } from '../src/lib/sop-regenerator';
import mongoose from 'mongoose';

async function testSOPRegeneration() {
  try {
    console.log('🔄 Testing SOP Regeneration System...\n');
    
    await connectToDatabase();
    
    // Test 1: Check regeneration status
    console.log('📊 Test 1: Checking regeneration status for all SOPs');
    console.log('='.repeat(50));
    
    const humanSOPs = await HumanSOP.find({ isActive: true });
    
    for (const humanSOP of humanSOPs) {
      const needsRegeneration = await checkRegenerationNeeded(humanSOP.sopId);
      const agentSOP = await AgentSOP.findOne({ sopId: humanSOP.sopId, isActive: true });
      
      console.log(`\n${humanSOP.sopId}: ${humanSOP.title}`);
      console.log(`  HumanSOP Version: ${humanSOP.version}`);
      console.log(`  AgentSOP Version: ${agentSOP?.version || 'N/A'}`);
      console.log(`  Needs Regeneration: ${needsRegeneration ? '❌ Yes' : '✅ No'}`);
      
      if (agentSOP) {
        console.log(`  Last Synced: ${agentSOP.lastSyncedAt.toISOString()}`);
        console.log(`  Keywords: ${agentSOP.keywords.slice(0, 5).join(', ')}...`);
      }
    }
    
    // Test 2: Regenerate a single SOP
    console.log('\n\n🔧 Test 2: Regenerating SOP-001');
    console.log('='.repeat(50));
    
    const result = await regenerateAgentSOP('SOP-001');
    
    console.log(`\nRegeneration Result:`);
    console.log(`  Success: ${result.success ? '✅' : '❌'}`);
    console.log(`  Message: ${result.message}`);
    
    if (result.errors) {
      console.log(`  Errors: ${result.errors.join('\n          ')}`);
    }
    
    if (result.warnings) {
      console.log(`  Warnings: ${result.warnings.join('\n            ')}`);
    }
    
    if (result.agentSOP) {
      console.log(`\n  AgentSOP Details:`);
      console.log(`    Summary: ${result.agentSOP.summary.substring(0, 100)}...`);
      console.log(`    Objectives: ${result.agentSOP.sections.objectives.length} found`);
      console.log(`    Key Activities: ${result.agentSOP.sections.keyActivities.length} found`);
      console.log(`    Deliverables: ${result.agentSOP.sections.deliverables.length} found`);
      console.log(`    Tools/Templates: ${result.agentSOP.sections.toolsTemplates.length} found`);
    }
    
    // Test 3: Test version tracking
    console.log('\n\n📈 Test 3: Testing version tracking');
    console.log('='.repeat(50));
    
    const testSOP = await HumanSOP.findOne({ sopId: 'SOP-001' });
    if (testSOP) {
      const originalVersion = testSOP.version;
      
      // Make a small change
      testSOP.markdownContent += '\n\n<!-- Test comment for version tracking -->';
      await testSOP.save();
      
      console.log(`\nVersion before update: ${originalVersion}`);
      console.log(`Version after update: ${testSOP.version}`);
      console.log(`Version incremented: ${testSOP.version > originalVersion ? '✅' : '❌'}`);
      
      // Regenerate after change
      const regenResult = await regenerateAgentSOP('SOP-001');
      const updatedAgentSOP = await AgentSOP.findOne({ sopId: 'SOP-001' });
      
      console.log(`\nAgentSOP regenerated: ${regenResult.success ? '✅' : '❌'}`);
      console.log(`AgentSOP version: ${updatedAgentSOP?.version}`);
      
      // Revert the change
      testSOP.markdownContent = testSOP.markdownContent.replace('\n\n<!-- Test comment for version tracking -->', '');
      await testSOP.save();
    }
    
    // Test 4: Regenerate all SOPs
    console.log('\n\n🔄 Test 4: Regenerating all AgentSOPs');
    console.log('='.repeat(50));
    
    const allResults = await regenerateAllAgentSOPs();
    
    console.log(`\nRegeneration Summary:`);
    console.log(`  Total Processed: ${allResults.totalProcessed}`);
    console.log(`  Successful: ${allResults.successful} ✅`);
    console.log(`  Failed: ${allResults.failed} ❌`);
    
    if (allResults.failed > 0) {
      console.log(`\nFailed SOPs:`);
      allResults.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.message}`);
        });
    }
    
    // Test 5: Verify searchable content
    console.log('\n\n🔍 Test 5: Verifying searchable content');
    console.log('='.repeat(50));
    
    const agentSOPs = await AgentSOP.find({ isActive: true }).limit(2);
    
    for (const agentSOP of agentSOPs) {
      console.log(`\n${agentSOP.sopId}:`);
      console.log(`  Searchable content length: ${agentSOP.searchableContent?.length || 0} characters`);
      console.log(`  Sample: "${agentSOP.searchableContent?.substring(0, 100)}..."`);
    }
    
    console.log('\n\n✅ SOP Regeneration Testing Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the test
testSOPRegeneration();