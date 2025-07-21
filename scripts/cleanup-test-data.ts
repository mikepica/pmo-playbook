import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { connectToDatabase } from '../src/lib/mongodb';
import HumanSOP from '../src/models/HumanSOP';
import AgentSOP from '../src/models/AgentSOP';
import ChatHistory from '../src/models/ChatHistory';
import ChangeProposal from '../src/models/ChangeProposal';
import User from '../src/models/User';

async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up test data...\n');
    
    await connectToDatabase();
    
    // Clean up test data
    const humanSOPs = await HumanSOP.deleteMany({ sopId: 'SOP-001' });
    console.log(`Deleted ${humanSOPs.deletedCount} HumanSOPs`);
    
    const agentSOPs = await AgentSOP.deleteMany({ sopId: 'SOP-001' });
    console.log(`Deleted ${agentSOPs.deletedCount} AgentSOPs`);
    
    const users = await User.deleteMany({ email: 'test@example.com' });
    console.log(`Deleted ${users.deletedCount} Users`);
    
    console.log('\n✅ Cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupTestData();