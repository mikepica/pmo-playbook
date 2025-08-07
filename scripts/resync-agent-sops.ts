// Script to resync agent_sops with human_sops
import dotenv from 'dotenv';
const result = dotenv.config({ path: '.env.local' });
if (result.error) {
  console.error('Error loading .env.local:', result.error);
  process.exit(1);
}

async function checkCurrentState() {
  console.log('🔍 Checking current state of SOPs...\n');
  
  // Import after environment is loaded
  const { HumanSOP } = await import('../src/models/HumanSOP');
  const { AgentSOP } = await import('../src/models/AgentSOP');
  
  try {
    // Get all human SOPs
    const humanSOPs = await HumanSOP.getAllActiveSOPs();
    console.log(`📋 Found ${humanSOPs.length} active Human SOPs:`);
    humanSOPs.forEach(sop => {
      console.log(`  - ${sop.sopId}: "${sop.data.title}" (v${sop.version}) - Phase ${sop.phase}`);
    });
    
    console.log('\n🤖 Checking Agent SOPs:');
    let agentSOPCount = 0;
    let syncIssues = [];
    
    for (const humanSOP of humanSOPs) {
      const agentSOP = await AgentSOP.findBySopId(humanSOP.sopId);
      if (agentSOP) {
        agentSOPCount++;
        // Check if sync is needed
        const needsSync = humanSOP.updatedAt > agentSOP.lastSyncedAt;
        const status = needsSync ? '❌ OUT OF SYNC' : '✅ IN SYNC';
        console.log(`  - ${agentSOP.sopId}: "${agentSOP.data.title}" (v${agentSOP.version}) ${status}`);
        if (needsSync) {
          syncIssues.push(humanSOP.sopId);
        }
      } else {
        console.log(`  - ${humanSOP.sopId}: ❌ MISSING Agent SOP`);
        syncIssues.push(humanSOP.sopId);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Human SOPs: ${humanSOPs.length}`);
    console.log(`  - Agent SOPs: ${agentSOPCount}`);
    console.log(`  - SOPs needing sync: ${syncIssues.length}`);
    
    if (syncIssues.length > 0) {
      console.log(`  - SOPs with issues: ${syncIssues.join(', ')}`);
    }
    
    return { humanSOPs, agentSOPCount, syncIssues };
  } catch (error) {
    console.error('❌ Error checking current state:', error);
    throw error;
  }
}

async function performResync() {
  console.log('\n🔄 Starting resync process...\n');
  
  // Import after environment is loaded
  const { regenerateAllAgentSOPs } = await import('../src/lib/sop-regenerator');
  
  try {
    const result = await regenerateAllAgentSOPs();
    
    console.log('✅ Resync completed!');
    console.log(`📊 Results:`);
    console.log(`  - Total processed: ${result.totalProcessed}`);
    console.log(`  - Successful: ${result.successful}`);
    console.log(`  - Failed: ${result.failed}`);
    
    if (result.failed > 0) {
      console.log('\n❌ Failed regenerations:');
      result.results.forEach(r => {
        if (!r.success) {
          console.log(`  - ${r.message}`);
          if (r.errors) {
            r.errors.forEach(error => console.log(`    • ${error}`));
          }
        }
      });
    }
    
    if (result.successful > 0) {
      console.log('\n✅ Successful regenerations:');
      result.results.forEach(r => {
        if (r.success) {
          console.log(`  - ${r.message}`);
          if (r.warnings && r.warnings.length > 0) {
            r.warnings.forEach(warning => console.log(`    ⚠️ ${warning}`));
          }
        }
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error during resync:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Agent SOP Resync Process\n');
  
  try {
    // Check current state
    const initialState = await checkCurrentState();
    
    if (initialState.syncIssues.length === 0) {
      console.log('\n🎉 All Agent SOPs are already in sync! No action needed.');
      return;
    }
    
    // Perform resync
    const resyncResult = await performResync();
    
    // Check final state
    console.log('\n🔍 Checking final state...');
    await checkCurrentState();
    
    console.log('\n🎉 Resync process completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Resync process failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);