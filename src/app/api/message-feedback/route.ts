import { NextResponse } from 'next/server';
import { MessageFeedback } from '@/models/MessageFeedback';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, sessionId, rating, sopUsed, confidence, feedbackReason } = body;
    
    if (!messageId || !sessionId || !rating || !sopUsed || confidence === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if feedback already exists for this message
    const existingFeedback = await MessageFeedback.findByMessageId(messageId);
    
    if (existingFeedback) {
      return NextResponse.json({
        success: true,
        message: 'Feedback already exists',
        feedback: existingFeedback
      });
    }
    
    // Create new feedback
    const feedbackData = {
      messageId,
      sessionId,
      rating,
      sopUsed,
      confidence,
      feedbackReason: feedbackReason || '',
      timestamp: new Date()
    };
    
    const feedback = await MessageFeedback.createFeedback(messageId, sessionId, feedbackData);
    
    return NextResponse.json({
      success: true,
      message: 'Feedback recorded',
      feedback
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const stats = searchParams.get('stats');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Get feedback stats
    if (stats === 'all' || stats === 'true') {
      const feedbackStats = await MessageFeedback.getFeedbackStats();
      return NextResponse.json(feedbackStats);
    }
    
    // Get feedback for a session
    if (sessionId) {
      const feedback = await MessageFeedback.findBySessionId(sessionId);
      return NextResponse.json({ feedback });
    }
    
    // Get recent feedback
    const feedback = await MessageFeedback.getRecentFeedback(limit);
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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