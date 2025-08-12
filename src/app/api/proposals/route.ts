import { NextResponse } from 'next/server';
import { ChangeProposal } from '@/models/ChangeProposal';

// GET all proposals with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sopId = searchParams.get('sopId');
    
    let proposals;
    
    if (status) {
      proposals = await ChangeProposal.findByStatus(status);
    } else if (sopId) {
      proposals = await ChangeProposal.findBySopId(sopId);
    } else {
      // Get all proposals (limited for performance)
      const results = await ChangeProposal.findMany({}, { orderBy: 'created_at DESC', limit: 100 });
      proposals = results.map(row => ({
        id: row.id,
        proposalId: row.proposal_id,
        sopId: row.sop_id,
        data: row.data,
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
    
    return NextResponse.json({
      success: true,
      proposals,
      total: proposals.length
    });
  } catch (error) {
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
      proposalTitle,
      proposalDescription,
      sopId,
      originalContent,
      proposedContent,
      justification,
      impactAssessment,
      submittedBy
    } = body;
    
    if (!proposalTitle || !proposalDescription || !sopId || !proposedContent || !justification || !submittedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const proposalId = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const proposalData = {
      proposalTitle,
      proposalDescription,
      sopId,
      originalContent,
      proposedContent,
      justification,
      impactAssessment,
      submittedBy
    };
    
    const proposal = await ChangeProposal.createProposal(proposalId, sopId, proposalData);
    
    return NextResponse.json({
      success: true,
      message: 'Proposal created successfully',
      proposalId: proposal.proposalId,
      proposal
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}