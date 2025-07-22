import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { connectToDatabase } from '../src/lib/mongodb';
import AgentSOP from '../src/models/AgentSOP';

async function demonstrateSOPQueries() {
  try {
    console.log('🎬 SOP Query Demonstration\n');
    
    await connectToDatabase();
    
    // Demo 1: Get all SOP summaries (for AI selection)
    console.log('📋 Demo 1: All Available SOPs for AI Selection');
    const summaries = await AgentSOP.getAllSummaries();
    summaries.forEach((sop, index) => {
      console.log(`${index + 1}. ${sop.sopId}: ${sop.title}`);
      console.log(`   Phase ${sop.phase} - ${sop.summary}`);
      console.log(`   Keywords: ${sop.keywords.join(', ')}\n`);
    });
    
    // Demo 2: Simulate AI SOP selection process
    console.log('🤖 Demo 2: AI SOP Selection Process');
    const userQueries = [
      'How do I create a business case for a new project?',
      'What do I need to do to kick off a project?', 
      'How do I plan project resources and timeline?',
      'What reports should I create during project execution?',
      'How do I properly close out a completed project?'
    ];
    
    for (const query of userQueries) {
      console.log(`\n👤 User Query: "${query}"`);
      
      const results = await AgentSOP.findBestMatch(query);
      if (results.length > 0) {
        const bestMatch = results[0];
        console.log(`🎯 Selected SOP: ${bestMatch.sopId} - ${bestMatch.title}`);
        console.log(`📄 Summary: ${bestMatch.summary}`);
        console.log(`🔑 Key Activities:`);
        bestMatch.sections.keyActivities.slice(0, 3).forEach((activity, i) => {
          console.log(`   ${i + 1}. ${activity}`);
        });
      } else {
        console.log('❌ No matching SOP found');
      }
    }
    
    // Demo 3: Show detailed SOP content for AI context
    console.log('\n\n📖 Demo 3: Detailed SOP Context for AI');
    const sampleSOP = await AgentSOP.findOne({ sopId: 'SOP-002' });
    if (sampleSOP) {
      const aiContext = sampleSOP.generateAIContext();
      console.log(`\n🎯 SOP: ${aiContext.title} (${aiContext.sopId})`);
      console.log(`📝 Summary: ${aiContext.summary}`);
      console.log(`\n🎯 Objectives:`);
      aiContext.sections.objectives.forEach(obj => console.log(`   - ${obj}`));
      console.log(`\n📋 Key Activities:`);
      aiContext.sections.keyActivities.forEach((act, i) => console.log(`   ${i + 1}. ${act}`));
      console.log(`\n📦 Deliverables:`);
      aiContext.sections.deliverables.forEach(del => console.log(`   - ${del}`));
      console.log(`\n👥 Roles & Responsibilities:`);
      aiContext.sections.rolesResponsibilities.forEach(role => {
        console.log(`   ${role.role}:`);
        role.responsibilities.forEach(resp => console.log(`     - ${resp}`));
      });
      console.log(`\n🛠️ Tools & Templates:`);
      aiContext.sections.toolsTemplates.forEach(tool => console.log(`   - ${tool}`));
    }
    
    console.log('\n🎉 Demo completed! SOPs are ready for AI integration.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

demonstrateSOPQueries();