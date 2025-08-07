// Force sync timestamps for specific SOPs
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function forceSyncTimestamps() {
  const { AgentSOP } = await import('../src/models/AgentSOP');
  
  console.log('🔄 Force updating sync timestamps...\n');
  
  const sopsToUpdate = ['SOP-001', 'SOP-003'];
  const now = new Date();
  
  for (const sopId of sopsToUpdate) {
    const agentSOP = await AgentSOP.findBySopId(sopId);
    
    if (agentSOP) {
      console.log(`Updating ${sopId} last_synced_at to ${now.toISOString()}`);
      
      await AgentSOP.update(
        { id: agentSOP.id },
        { last_synced_at: now }
      );
      
      console.log(`✅ ${sopId} timestamp updated`);
    }
  }
  
  console.log('\n🔍 Verification...');
  
  const { HumanSOP } = await import('../src/models/HumanSOP');
  
  for (const sopId of sopsToUpdate) {
    const humanSOP = await HumanSOP.findBySopId(sopId);
    const agentSOP = await AgentSOP.findBySopId(sopId);
    
    if (humanSOP && agentSOP) {
      const needsSync = humanSOP.updatedAt > agentSOP.lastSyncedAt;
      const status = needsSync ? '❌ STILL OUT OF SYNC' : '✅ IN SYNC';
      console.log(`${sopId}: ${status}`);
      console.log(`  Human updated: ${new Date(humanSOP.updatedAt).toISOString()}`);
      console.log(`  Agent synced:  ${new Date(agentSOP.lastSyncedAt).toISOString()}`);
    }
  }
}

forceSyncTimestamps();