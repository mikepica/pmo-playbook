// Script to check sync timestamps
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkTimestamps() {
  const { HumanSOP } = await import('../src/models/HumanSOP');
  const { AgentSOP } = await import('../src/models/AgentSOP');

  console.log('🔍 Checking sync timestamps...\n');
  
  try {
    const humanSOPs = await HumanSOP.getAllActiveSOPs();
    
    for (const humanSOP of humanSOPs) {
      const agentSOP = await AgentSOP.findBySopId(humanSOP.sopId);
      
      if (agentSOP) {
        const humanUpdated = new Date(humanSOP.updatedAt);
        const agentSynced = new Date(agentSOP.lastSyncedAt);
        const needsSync = humanUpdated > agentSynced;
        
        console.log(`${humanSOP.sopId}:`);
        console.log(`  Human updated: ${humanUpdated.toISOString()}`);
        console.log(`  Agent synced:  ${agentSynced.toISOString()}`);
        console.log(`  Needs sync:    ${needsSync}`);
        console.log(`  Time diff:     ${humanUpdated.getTime() - agentSynced.getTime()}ms`);
        console.log('');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTimestamps();