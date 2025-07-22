import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ChatHistory from '@/models/ChatHistory';
import OpenAI from 'openai';

// GET all sessions for the user (with summaries)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    await connectToDatabase();

    // Get recent sessions, ordered by lastActive
    const sessions = await ChatHistory.find({})
      .select('sessionId sessionName summary messages startedAt lastActive')
      .sort({ lastActive: -1 })
      .limit(limit);

    // Format sessions for dropdown
    const formattedSessions = await Promise.all(sessions.map(async (session) => {
      // Generate summary if it doesn't exist
      let summary = session.summary;
      if (!summary && session.messages.length > 0) {
        summary = await generateSessionSummary(session);
        // Save the summary for future use
        session.summary = summary;
        await session.save();
      }

      return {
        sessionId: session.sessionId,
        name: session.sessionName || summary || 'Untitled Session',
        summary: summary || 'No summary available',
        messageCount: session.messages.length,
        startedAt: session.startedAt,
        lastActive: session.lastActive || session.startedAt,
        isActive: session.sessionId === searchParams.get('currentSessionId')
      };
    }));

    return NextResponse.json({
      sessions: formattedSessions,
      total: formattedSessions.length
    });

  } catch (error: unknown) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// PATCH update session (rename, update lastActive)
export async function PATCH(request: Request) {
  try {
    const { sessionId, sessionName, updateLastActive } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'SessionId is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const updateData: Record<string, unknown> = {};
    if (sessionName !== undefined) {
      updateData.sessionName = sessionName;
    }
    if (updateLastActive) {
      updateData.lastActive = new Date();
    }

    const updatedSession = await ChatHistory.findOneAndUpdate(
      { sessionId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        sessionId: updatedSession.sessionId,
        sessionName: updatedSession.sessionName,
        lastActive: updatedSession.lastActive
      }
    });

  } catch (error: unknown) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// DELETE session
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'SessionId is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const deletedSession = await ChatHistory.findOneAndDelete({ sessionId });

    if (!deletedSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

// Helper function to generate AI summary
async function generateSessionSummary(session: any): Promise<string> {
  try {
    // Get first few user messages to understand the topic
    const userMessages = session.messages
      .filter((m: any) => m.role === 'user')
      .slice(0, 3)
      .map((m: any) => m.content)
      .join(' ');

    if (!userMessages) {
      return 'Empty conversation';
    }

    const prompt = `Summarize this conversation topic in 3-5 words. Be very concise. Focus on the main subject or question.

User messages: "${userMessages}"

Examples of good summaries:
- "Project Charter Creation"
- "Risk Management Strategies"
- "Stakeholder Communication Plans"
- "Budget Overrun Handling"

Summary:`;

    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a concise summarizer. Provide very brief 3-5 word summaries.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 20
      });

      const summary = response.choices[0]?.message?.content?.trim() || 'Conversation';
      return summary.replace(/['"]/g, ''); // Remove quotes if any
    } catch (aiError) {
      console.warn('Failed to generate AI summary:', aiError);
      // Fallback to extracting key words from first message
      const firstWords = userMessages.split(' ').slice(0, 5).join(' ');
      return firstWords.length > 30 ? firstWords.substring(0, 30) + '...' : firstWords;
    }
  } catch (error) {
    console.error('Error in generateSessionSummary:', error);
    return 'Conversation';
  }
}