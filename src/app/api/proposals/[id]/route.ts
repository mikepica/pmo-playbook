import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ChangeProposal from '@/models/ChangeProposal';

// GET individual proposal
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const proposal = await ChangeProposal.findOne({ proposalId: params.id })
      .populate('humanSopId', 'title version markdownContent');

    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ proposal });

  } catch (error: unknown) {
    console.error('Error fetching proposal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal' },
      { status: 500 }
    );
  }
}

// PATCH update proposal
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { action, performedBy, comments, reason } = body;

    await connectToDatabase();

    const proposal = await ChangeProposal.findOne({ proposalId: params.id });
    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'approve':
        await proposal.approve(performedBy || 'admin', comments);
        break;
      
      case 'reject':
        if (!reason) {
          return NextResponse.json(
            { error: 'Rejection reason is required' },
            { status: 400 }
          );
        }
        await proposal.reject(performedBy || 'admin', reason);
        break;
      
      case 'review':
        proposal.reviewHistory.push({
          action: 'reviewed',
          performedBy: performedBy || 'admin',
          timestamp: new Date(),
          comments
        });
        await proposal.save();
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: approve, reject, or review' },
          { status: 400 }
        );
    }

    return NextResponse.json({ 
      proposal,
      message: `Proposal ${action}ed successfully`
    });

  } catch (error: unknown) {
    console.error('Error updating proposal:', error);
    return NextResponse.json(
      { error: 'Failed to update proposal' },
      { status: 500 }
    );
  }
}

// DELETE proposal (archive)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const proposal = await ChangeProposal.findOne({ proposalId: params.id });
    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Archive instead of delete
    proposal.status = 'archived';
    proposal.reviewHistory.push({
      action: 'archived',
      performedBy: 'admin',
      timestamp: new Date(),
      comments: 'Proposal archived'
    });
    await proposal.save();

    return NextResponse.json({ 
      message: 'Proposal archived successfully',
      proposal
    });

  } catch (error: unknown) {
    console.error('Error archiving proposal:', error);
    return NextResponse.json(
      { error: 'Failed to archive proposal' },
      { status: 500 }
    );
  }
}