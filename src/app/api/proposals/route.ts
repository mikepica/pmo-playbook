import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ChangeProposal from '@/models/ChangeProposal';
import HumanSOP from '@/models/HumanSOP';
import AgentSOP from '@/models/AgentSOP';

// GET all proposals with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const sopId = searchParams.get('sopId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    await connectToDatabase();

    // Build query
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (sopId) query.sopId = sopId;

    // Get proposals with pagination
    const proposals = await ChangeProposal.find(query)
      .populate('humanSopId', 'title version')
      .sort({ priority: -1, 'metrics.confidenceScore': -1, createdAt: -1 })
      .limit(limit)
      .skip(skip);

    // Get total count for pagination
    const totalCount = await ChangeProposal.countDocuments(query);

    return NextResponse.json({
      proposals,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + limit < totalCount
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching proposals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}

// POST create new proposal
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sopId,
      triggerQuery,
      conversationContext,
      proposedChange,
      metrics
    } = body;

    // Validate required fields
    if (!sopId || !triggerQuery || !proposedChange) {
      return NextResponse.json(
        { error: 'Missing required fields: sopId, triggerQuery, proposedChange' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get the humanSopId from the sopId
    const agentSOP = await AgentSOP.findOne({ sopId }).select('humanSopId');
    if (!agentSOP) {
      return NextResponse.json(
        { error: `SOP ${sopId} not found` },
        { status: 404 }
      );
    }

    // Check for similar existing proposals to avoid duplicates
    const similarProposals = await ChangeProposal.findSimilarProposals(
      sopId,
      proposedChange.section,
      proposedChange.changeType || 'clarification'
    );

    // If very similar proposal exists (same section and recent), update metrics instead
    if (similarProposals.length > 0) {
      const recentProposal = similarProposals.find(p => {
        const hoursSinceCreation = (Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60);
        return hoursSinceCreation < 24 && p.status === 'pending_review';
      });

      if (recentProposal) {
        // Update existing proposal metrics
        recentProposal.metrics.affectedUsersCount += 1;
        recentProposal.metrics.similarProposalsCount = similarProposals.length;
        await recentProposal.save();

        return NextResponse.json({
          proposal: recentProposal,
          isUpdate: true,
          message: 'Updated existing similar proposal metrics'
        });
      }
    }

    // Create new proposal
    const proposal = await ChangeProposal.create({
      sopId,
      humanSopId: agentSOP.humanSopId,
      triggerQuery,
      conversationContext: conversationContext || {
        sessionId: `session-${Date.now()}`,
        messages: [{ role: 'user', content: triggerQuery }],
        timestamp: new Date()
      },
      proposedChange: {
        ...proposedChange,
        changeType: proposedChange.changeType || 'clarification'
      },
      metrics: {
        confidenceScore: metrics?.confidenceScore || 0.7,
        affectedUsersCount: 1,
        similarProposalsCount: similarProposals.length
      },
      tags: extractTags(proposedChange)
    });

    return NextResponse.json({
      proposal,
      isUpdate: false,
      similarCount: similarProposals.length
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating proposal:', error);
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}

// Helper function to extract tags from proposed change
function extractTags(proposedChange: { section: string; changeType?: string }): string[] {
  const tags: string[] = [];
  
  // Add section as tag
  if (proposedChange.section) {
    tags.push(proposedChange.section.toLowerCase().replace(/\s+/g, '-'));
  }
  
  // Add change type as tag
  if (proposedChange.changeType) {
    tags.push(proposedChange.changeType);
  }
  
  // Add common keywords
  const keywords = ['template', 'checklist', 'process', 'role', 'deliverable', 'tool'];
  const content = JSON.stringify(proposedChange).toLowerCase();
  
  keywords.forEach(keyword => {
    if (content.includes(keyword)) {
      tags.push(keyword);
    }
  });
  
  return [...new Set(tags)]; // Remove duplicates
}