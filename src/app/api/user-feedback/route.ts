import { NextResponse } from 'next/server';
import { UserFeedback } from '@/models/UserFeedback';

// GET all user feedback with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');

    let feedback;
    
    if (status) {
      feedback = await UserFeedback.findByStatus(status);
    } else if (sessionId) {
      feedback = await UserFeedback.findBySessionId(sessionId);
    } else {
      feedback = await UserFeedback.getAllFeedback(limit);
    }

    return NextResponse.json({
      success: true,
      feedback,
      total: feedback.length
    });
  } catch (error) {
    console.error('Error fetching user feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user feedback' },
      { status: 500 }
    );
  }
}

// POST create new user feedback
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      feedbackType,
      title,
      description,
      sessionId,
      sopId,
      rating,
      submittedBy,
      userEmail
    } = body;

    if (!feedbackType || !title || !description || !submittedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: feedbackType, title, description, submittedBy' },
        { status: 400 }
      );
    }

    const feedbackId = `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const feedbackData = {
      feedbackType,
      title,
      description,
      sessionId,
      sopId,
      rating,
      submittedBy,
      userEmail
    };

    const feedback = await UserFeedback.createFeedback(feedbackId, feedbackData, sessionId);

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId: feedback.feedbackId,
      feedback
    });
  } catch (error) {
    console.error('Error creating user feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}