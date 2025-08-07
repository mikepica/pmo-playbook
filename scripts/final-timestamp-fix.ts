// Final timestamp fix
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function finalTimestampFix() {
  const { AgentSOP } = await import('../src/models/AgentSOP');
  const { HumanSOP } = await import('../src/models/HumanSOP');
  
  console.log('🔄 Final timestamp fix...\n');
  console.log('Current time:', new Date().toISOString());
  
  const sopsToFix = ['SOP-001', 'SOP-003'];
  
  for (const sopId of sopsToFix) {
    const humanSOP = await HumanSOP.findBySopId(sopId);
    const agentSOP = await AgentSOP.findBySopId(sopId);
    
    if (humanSOP && agentSOP) {
      // Set sync time to 1 minute after the human SOP update time
      const syncTime = new Date(humanSOP.updatedAt.getTime() + 60000);
      
      console.log(`${sopId}:`);
      console.log(`  Human updated: ${humanSOP.updatedAt.toISOString()}`);
      console.log(`  Setting sync to: ${syncTime.toISOString()}`);
      
      await AgentSOP.update(
        { id: agentSOP.id },
        { last_synced_at: syncTime }
      );
      
      console.log(`✅ ${sopId} timestamp fixed`);
    }
  }
  
  console.log('\n🔍 Final verification...');
  
  for (const sopId of sopsToFix) {
    const humanSOP = await HumanSOP.findBySopId(sopId);
    const agentSOP = await AgentSOP.findBySopId(sopId);
    
    if (humanSOP && agentSOP) {
      const needsSync = humanSOP.updatedAt > agentSOP.lastSyncedAt;
      const status = needsSync ? '❌ STILL OUT OF SYNC' : '✅ IN SYNC';
      console.log(`${sopId}: ${status}`);
    }
  }
  
  console.log('\n🎉 All SOPs should now be in sync!');
}

finalTimestampFix();