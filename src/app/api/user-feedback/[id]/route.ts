import { NextResponse } from 'next/server';
import { UserFeedback } from '@/models/UserFeedback';

// GET specific feedback by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const feedback = await UserFeedback.findByFeedbackId(id);
    
    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}

// PUT update feedback status or admin response
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, adminResponse } = body;
    
    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }
    
    const updatedFeedback = await UserFeedback.updateStatus(id, status, adminResponse);
    
    if (!updatedFeedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Feedback updated successfully',
      feedback: updatedFeedback
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to update feedback' },
      { status: 500 }
    );
  }
}

// DELETE feedback (placeholder - not implemented)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function DELETE(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    return NextResponse.json(
      { message: 'Delete functionality not yet implemented in PostgreSQL version' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to delete feedback' },
      { status: 500 }
    );
  }
}