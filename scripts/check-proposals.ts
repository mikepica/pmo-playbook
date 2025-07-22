#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import path from 'path';
import { connectToDatabase } from '../src/lib/mongodb';
import ChangeProposal from '../src/models/ChangeProposal';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function checkProposals() {
  try {
    await connectToDatabase();
    console.log('✅ Connected to MongoDB\n');

    const count = await ChangeProposal.countDocuments();
    console.log(`📊 Total proposals in database: ${count}`);
    
    const pendingCount = await ChangeProposal.countDocuments({ status: 'pending_review' });
    console.log(`⏳ Pending review: ${pendingCount}`);
    
    const recent = await ChangeProposal.find({})
      .populate('humanSopId', 'title')
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log('\n📝 Recent proposals:');
    recent.forEach(p => {
      console.log(`\n🔹 Proposal: ${p.proposalId}`);
      console.log(`   SOP: ${p.sopId} - ${p.humanSopId?.title || 'N/A'}`);
      console.log(`   Section: ${p.proposedChange?.section}`);
      console.log(`   Type: ${p.proposedChange?.changeType}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Priority: ${p.priority}`);
      console.log(`   Confidence: ${p.metrics?.confidenceScore}`);
      console.log(`   Affected Users: ${p.metrics?.affectedUsersCount}`);
      console.log(`   Created: ${p.createdAt.toLocaleString()}`);
      console.log(`   Trigger: "${p.triggerQuery.substring(0, 50)}..."`);
    });

    // Check for duplicates
    const duplicateCheck = await ChangeProposal.aggregate([
      {
        $group: {
          _id: {
            sopId: '$sopId',
            section: '$proposedChange.section'
          },
          count: { $sum: 1 },
          proposals: { $push: '$proposalId' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    if (duplicateCheck.length > 0) {
      console.log('\n⚠️  Potential duplicates found:');
      duplicateCheck.forEach(dup => {
        console.log(`   ${dup._id.sopId} - ${dup._id.section}: ${dup.count} proposals`);
      });
    } else {
      console.log('\n✅ No duplicate proposals detected');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkProposals();