import { NextResponse } from 'next/server';
import { ChangeProposal } from '@/models/ChangeProposal';

// GET specific proposal by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const proposal = await ChangeProposal.findByProposalId(id);
    
    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      proposal
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal' },
      { status: 500 }
    );
  }
}

// PUT update proposal status or review
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, reviewComments } = body;
    
    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }
    
    const updatedProposal = await ChangeProposal.updateStatus(id, status, reviewComments);
    
    if (!updatedProposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Proposal updated successfully',
      proposal: updatedProposal
    });
  } catch (error) {
    console.error('Error updating proposal:', error);
    return NextResponse.json(
      { error: 'Failed to update proposal' },
      { status: 500 }
    );
  }
}

// DELETE proposal (placeholder - not implemented)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return NextResponse.json(
      { message: 'Delete functionality not yet implemented in PostgreSQL version' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error deleting proposal:', error);
    return NextResponse.json(
      { error: 'Failed to delete proposal' },
      { status: 500 }
    );
  }
}