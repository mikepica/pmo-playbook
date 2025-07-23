import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import UserFeedback from '@/models/UserFeedback';
import ChatHistory from '@/models/ChatHistory';
import AgentSOP from '@/models/AgentSOP';

// GET all user feedback with filtering
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

    // Get feedback with pagination
    const feedback = await UserFeedback.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip);

    // Get total count for pagination
    const totalCount = await UserFeedback.countDocuments(query);

    // Get status counts for filter options
    const statusCounts = await UserFeedback.getFeedbackWithCounts();

    return NextResponse.json({
      feedback,
      statusCounts,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + limit < totalCount
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching user feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}

// POST create new user feedback
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sessionId,
      messageId,
      userQuestion,
      aiResponse,
      userComment,
      sopId,
      sopTitle,
      confidence
    } = body;

    // Validate required fields
    if (!sessionId || !userQuestion || !aiResponse || !userComment || !sopId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Verify the session exists
    const chatSession = await ChatHistory.findOne({ sessionId });
    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Get SOP info if not provided
    let resolvedSopTitle = sopTitle;
    if (!resolvedSopTitle && sopId) {
      const agentSOP = await AgentSOP.findOne({ sopId }).select('title');
      resolvedSopTitle = agentSOP?.title || 'Unknown SOP';
    }

    // Create new feedback
    const feedback = await UserFeedback.create({
      sessionId,
      messageId: messageId || `msg-${Date.now()}`,
      userQuestion,
      aiResponse,
      userComment,
      sopId,
      sopTitle: resolvedSopTitle,
      sopSection: '', // Will be populated when admin reviews
      confidence: confidence || 0.5,
      status: 'pending',
      priority: 'medium' // User feedback always starts as medium priority
    });

    return NextResponse.json({
      feedback,
      message: 'Thank you for your feedback. We will review this and improve our knowledge base.'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating user feedback:', error);
    return NextResponse.json(
      { error: 'Failed to create feedback' },
      { status: 500 }
    );
  }
}