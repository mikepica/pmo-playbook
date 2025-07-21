import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { connectToDatabase } from '../src/lib/mongodb';
import HumanSOP from '../src/models/HumanSOP';
import AgentSOP from '../src/models/AgentSOP';
import ChatHistory from '../src/models/ChatHistory';
import ChangeProposal from '../src/models/ChangeProposal';
import User from '../src/models/User';

async function testModels() {
  try {
    console.log('🚀 Starting model tests...\n');
    
    // Connect to database
    console.log('📡 Connecting to MongoDB...');
    await connectToDatabase();
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Create HumanSOP
    console.log('📝 Testing HumanSOP model...');
    const humanSOP = await HumanSOP.create({
      sopId: 'SOP-001',
      title: 'Pre-Initiate Phase',
      phase: 1,
      markdownContent: '# Pre-Initiate Phase\n\n## Objectives\n- Define project vision\n- Identify stakeholders',
      createdBy: 'system'
    });
    console.log('✅ HumanSOP created:', humanSOP.sopId);

    // Test 2: Create AgentSOP
    console.log('\n🤖 Testing AgentSOP model...');
    const agentSOP = new AgentSOP({
      sopId: 'SOP-001',
      humanSopId: humanSOP._id,
      title: 'Pre-Initiate Phase',
      phase: 1,
      summary: 'Guidelines for project pre-initiation including vision definition and stakeholder identification',
      description: 'This SOP covers the initial phase of project management',
      sections: {
        objectives: ['Define project vision', 'Identify stakeholders'],
        keyActivities: ['Conduct feasibility study', 'Create business case'],
        deliverables: ['Project charter', 'Stakeholder register'],
        rolesResponsibilities: [{
          role: 'Project Manager',
          responsibilities: ['Lead pre-initiation activities', 'Coordinate with stakeholders']
        }],
        toolsTemplates: ['Project charter template', 'Business case template']
      },
      keywords: ['pre-initiate', 'vision', 'stakeholder', 'charter'],
      searchableContent: '' // Will be set by pre-save middleware
    });
    await agentSOP.save();
    console.log('✅ AgentSOP created:', agentSOP.sopId);

    // Test 3: Create ChatHistory
    console.log('\n💬 Testing ChatHistory model...');
    const chatHistory = await ChatHistory.create({
      sessionId: `session-${Date.now()}`,
      messages: [{
        role: 'user',
        content: 'How do I start a new project?',
        timestamp: new Date()
      }, {
        role: 'assistant',
        content: 'To start a new project, follow the Pre-Initiate Phase guidelines...',
        timestamp: new Date(),
        selectedSopId: 'SOP-001',
        confidence: 0.95
      }],
      metadata: {
        userAgent: 'Test Script'
      }
    });
    console.log('✅ ChatHistory created:', chatHistory.sessionId);

    // Test 4: Create ChangeProposal
    console.log('\n📋 Testing ChangeProposal model...');
    const changeProposal = await ChangeProposal.create({
      sopId: 'SOP-001',
      humanSopId: humanSOP._id,
      triggerQuery: 'How do I communicate with stakeholders during pre-initiation?',
      conversationContext: {
        sessionId: chatHistory.sessionId,
        messages: [{
          role: 'user',
          content: 'How do I communicate with stakeholders during pre-initiation?'
        }],
        timestamp: new Date()
      },
      proposedChange: {
        section: 'Key Activities',
        originalContent: 'Conduct feasibility study',
        suggestedContent: 'Conduct feasibility study\n- Schedule stakeholder meetings\n- Create communication plan',
        changeType: 'addition',
        rationale: 'User query indicates need for stakeholder communication guidance'
      },
      metrics: {
        confidenceScore: 0.85
      }
    });
    console.log('✅ ChangeProposal created:', changeProposal.proposalId);

    // Test 5: Create User
    console.log('\n👤 Testing User model...');
    const user = await User.create({
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin'
    });
    console.log('✅ User created:', user.userId);

    // Test model methods
    console.log('\n🔧 Testing model methods...');
    
    // Test HumanSOP methods
    const activeSOPs = await HumanSOP.getActiveByPhase(1);
    console.log(`  - Found ${activeSOPs.length} active SOPs for phase 1`);

    // Test AgentSOP methods
    const sopSummaries = await AgentSOP.getAllSummaries();
    console.log(`  - Retrieved ${sopSummaries.length} SOP summaries`);

    // Test ChatHistory methods
    await chatHistory.addMessage({
      role: 'user',
      content: 'Thank you for the help!'
    });
    console.log('  - Added message to chat history');

    // Test ChangeProposal methods
    await changeProposal.approve('admin', 'Good suggestion');
    console.log('  - Approved change proposal');

    // Test User methods
    console.log(`  - User has edit permission: ${user.hasPermission('canEditSOPs')}`);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await HumanSOP.deleteOne({ _id: humanSOP._id });
    await AgentSOP.deleteOne({ _id: agentSOP._id });
    await ChatHistory.deleteOne({ _id: chatHistory._id });
    await ChangeProposal.deleteOne({ _id: changeProposal._id });
    await User.deleteOne({ _id: user._id });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All model tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testModels();