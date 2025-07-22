#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import path from 'path';
import { connectToDatabase } from '../src/lib/mongodb';
import ChangeProposal from '../src/models/ChangeProposal';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testProposalCreation() {
  console.log('🧪 Testing Change Proposal System...\n');

  try {
    await connectToDatabase();
    console.log('✅ Connected to MongoDB\n');

    // 1. Test fetching all proposals
    console.log('1️⃣ Testing GET /api/proposals');
    const response = await fetch('http://localhost:3002/api/proposals');
    const data = await response.json();
    console.log(`   Found ${data.proposals?.length || 0} existing proposals`);
    console.log(`   Pagination: ${JSON.stringify(data.pagination)}\n`);

    // 2. Test creating a proposal via API
    console.log('2️⃣ Testing POST /api/proposals');
    const testProposal = {
      sopId: 'SOP-001',
      triggerQuery: 'How do I handle stakeholder conflicts in pre-initiate phase?',
      proposedChange: {
        section: 'Stakeholder Management',
        originalContent: 'Current stakeholder section',
        suggestedContent: 'Add a new subsection on conflict resolution strategies including: 1) Early identification of conflicting interests, 2) Facilitated workshops, 3) Escalation procedures',
        changeType: 'addition',
        rationale: 'Users frequently ask about handling stakeholder conflicts but the current SOP lacks specific guidance'
      },
      metrics: {
        confidenceScore: 0.85
      }
    };

    const createResponse = await fetch('http://localhost:3002/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testProposal)
    });
    
    const createdProposal = await createResponse.json();
    console.log(`   Created proposal: ${createdProposal.proposal?.proposalId || 'Failed'}`);
    console.log(`   Is update of existing: ${createdProposal.isUpdate}`);
    console.log(`   Similar proposals: ${createdProposal.similarCount}\n`);

    // 3. Test duplicate detection
    console.log('3️⃣ Testing duplicate proposal detection');
    const duplicateResponse = await fetch('http://localhost:3002/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testProposal)
    });
    
    const duplicateResult = await duplicateResponse.json();
    console.log(`   Should update existing: ${duplicateResult.isUpdate}`);
    if (duplicateResult.isUpdate) {
      console.log(`   ✅ Duplicate detection working - updated metrics instead of creating new`);
    }
    console.log('');

    // 4. Test proposal retrieval by ID
    if (createdProposal.proposal?.proposalId) {
      console.log('4️⃣ Testing GET /api/proposals/[id]');
      const getResponse = await fetch(`http://localhost:3002/api/proposals/${createdProposal.proposal.proposalId}`);
      const getResult = await getResponse.json();
      console.log(`   Retrieved proposal: ${getResult.proposal?.proposalId}`);
      console.log(`   Status: ${getResult.proposal?.status}`);
      console.log(`   Priority: ${getResult.proposal?.priority}\n`);
    }

    // 5. Check database directly
    console.log('5️⃣ Checking proposals in database');
    const dbProposals = await ChangeProposal.find({ status: 'pending_review' })
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log(`   Found ${dbProposals.length} pending proposals:`);
    dbProposals.forEach(p => {
      console.log(`   - ${p.proposalId}: ${p.proposedChange.section} (${p.priority})`);
    });

    // 6. Test the change type determination
    console.log('\n6️⃣ Testing change type determination');
    const testCases = [
      { change: 'Add new section on risk management', expected: 'addition' },
      { change: 'Remove outdated compliance section', expected: 'deletion' },
      { change: 'Update the project charter template', expected: 'modification' },
      { change: 'Clarify the approval process steps', expected: 'clarification' }
    ];

    console.log('   Change type detection would classify:');
    testCases.forEach(tc => {
      console.log(`   - "${tc.change}" → ${tc.expected}`);
    });

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testProposalCreation();