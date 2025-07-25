import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import MessageFeedback from '@/models/MessageFeedback';

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
    
    await connectToDatabase();
    
    // Check if feedback already exists for this message
    const existingFeedback = await MessageFeedback.findOne({ messageId, sessionId });
    
    if (existingFeedback) {
      // Update existing feedback
      existingFeedback.rating = rating;
      existingFeedback.feedbackReason = feedbackReason;
      await existingFeedback.save();
      
      return NextResponse.json({
        success: true,
        message: 'Feedback updated',
        feedback: existingFeedback
      });
    } else {
      // Create new feedback
      const feedback = await MessageFeedback.create({
        messageId,
        sessionId,
        rating,
        sopUsed,
        confidence,
        feedbackReason
      });
      
      return NextResponse.json({
        success: true,
        message: 'Feedback recorded',
        feedback
      });
    }
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
    const sopId = searchParams.get('sopId');
    const stats = searchParams.get('stats');
    
    await connectToDatabase();
    
    // Get all analytics stats
    if (stats === 'all') {
      const totalRatings = await MessageFeedback.countDocuments();
      
      const byRating = await MessageFeedback.aggregate([
        { $group: { _id: '$rating', count: { $sum: 1 } } }
      ]);
      
      const bySOP = await MessageFeedback.aggregate([
        { 
          $group: { 
            _id: '$sopUsed',
            helpful: { $sum: { $cond: [{ $eq: ['$rating', 'helpful'] }, 1, 0] } },
            not_helpful: { $sum: { $cond: [{ $eq: ['$rating', 'not_helpful'] }, 1, 0] } },
            total: { $sum: 1 }
          }
        },
        {
          $project: {
            helpful: 1,
            not_helpful: 1,
            total: 1,
            rate: { $multiply: [{ $divide: ['$helpful', '$total'] }, 100] }
          }
        },
        { $sort: { total: -1 } }
      ]);
      
      const confidenceAccuracy = await MessageFeedback.getConfidenceAccuracy();
      
      return NextResponse.json({
        totalRatings,
        byRating: byRating.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        bySOP: bySOP.reduce((acc, item) => ({ ...acc, [item._id]: item }), {}),
        confidenceAccuracy
      });
    }
    
    // Get stats for a specific SOP
    if (stats === 'true' && sopId) {
      const sopStats = await MessageFeedback.getSOPStats(sopId);
      return NextResponse.json(sopStats);
    }
    
    // Get confidence accuracy stats
    if (stats === 'confidence') {
      const confidenceStats = await MessageFeedback.getConfidenceAccuracy();
      return NextResponse.json(confidenceStats);
    }
    
    // Get feedback for a session
    if (sessionId) {
      const feedback = await MessageFeedback.find({ sessionId })
        .sort({ createdAt: -1 });
      
      return NextResponse.json({ feedback });
    }
    
    // Get all feedback (for analytics)
    const limit = parseInt(searchParams.get('limit') || '100');
    const feedback = await MessageFeedback.find({})
      .sort({ createdAt: -1 })
      .limit(limit);
    
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
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const sessionId = searchParams.get('sessionId');
    
    if (!messageId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing messageId or sessionId' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    const result = await MessageFeedback.deleteOne({ messageId, sessionId });
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Feedback removed'
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to delete feedback' },
      { status: 500 }
    );
  }
}