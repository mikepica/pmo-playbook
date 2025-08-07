// Final sync for specific SOPs
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function finalSync() {
  const { regenerateAgentSOP } = await import('../src/lib/sop-regenerator');

  console.log('🔄 Running final sync for out-of-sync SOPs...\n');
  
  const sopsToSync = ['SOP-001', 'SOP-003'];
  
  for (const sopId of sopsToSync) {
    console.log(`Syncing ${sopId}...`);
    const result = await regenerateAgentSOP(sopId);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
    } else {
      console.log(`❌ Failed: ${result.message}`);
    }
  }
  
  console.log('\n🔍 Final verification...');
  
  // Wait a moment for database to be consistent
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const { HumanSOP } = await import('../src/models/HumanSOP');
  const { AgentSOP } = await import('../src/models/AgentSOP');
  
  for (const sopId of sopsToSync) {
    const humanSOP = await HumanSOP.findBySopId(sopId);
    const agentSOP = await AgentSOP.findBySopId(sopId);
    
    if (humanSOP && agentSOP) {
      const needsSync = humanSOP.updatedAt > agentSOP.lastSyncedAt;
      const status = needsSync ? '❌ STILL OUT OF SYNC' : '✅ IN SYNC';
      console.log(`${sopId}: ${status}`);
    }
  }
}

finalSync();