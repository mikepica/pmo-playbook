import { NextResponse } from 'next/server';
import { ChatHistory } from '@/models/ChatHistory';
import OpenAI from 'openai';
import { getSessionManagementConfig } from '@/lib/ai-config';
import { executeWithTimeout, TimeoutError } from '@/lib/utils/async-timeout';

const SESSION_SUMMARY_TIMEOUT_MS = Number.parseInt(process.env.AI_SUMMARY_TIMEOUT_MS || '10000', 10);
const ENABLE_ASYNC_SESSION_SUMMARIES = process.env.ENABLE_ASYNC_SESSION_SUMMARIES !== 'false';
const pendingSummarySessions = new Set<string>();

function getQuickSummary(messages: Array<{ role: string; content: string }>): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (!firstUserMessage || !firstUserMessage.content.trim()) {
    return 'Conversation';
  }

  const tokens = firstUserMessage.content
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5);

  if (tokens.length === 0) {
    return 'Conversation';
  }

  const summary = tokens.join(' ');
  return summary.length > 40 ? `${summary.slice(0, 37)}...` : summary;
}

async function queueAsyncSummaryGeneration(
  sessionId: string,
  messages: Array<{ role: string; content: string }>
) {
  if (!ENABLE_ASYNC_SESSION_SUMMARIES || pendingSummarySessions.has(sessionId)) {
    return;
  }

  pendingSummarySessions.add(sessionId);

  try {
    const summary = await generateSessionSummary({ messages });
    if (summary && summary.trim()) {
      await ChatHistory.updateSummary(sessionId, summary.trim());
    }
  } catch (error) {
    console.warn('Async session summary generation failed:', error);
  } finally {
    pendingSummarySessions.delete(sessionId);
  }
}

// GET all sessions for the user (with summaries)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const analytics = searchParams.get('analytics');
    
    // Database connection handled by model
    
    // Return analytics data
    if (analytics === 'true') {
      // Get basic session stats
      const activeSessions = await ChatHistory.getActiveSessions(1000); // Get all active sessions
      const totalSessions = activeSessions.length;
      const totalMessages = activeSessions.reduce((sum, session) => sum + session.data.messages.length, 0);
      const avgMessagesPerSession = totalMessages / (totalSessions || 1);
      
      // Get SOP usage stats
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sopUsageStats = await ChatHistory.getSOPUsageStats(sevenDaysAgo);
      const sopUsageFrequency = sopUsageStats.reduce((acc, stat) => ({ ...acc, [stat.sopId]: stat.totalUsage }), {});
      
      return NextResponse.json({
        totalSessions,
        totalMessages,
        avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
        sopUsageFrequency,
        recentActivity: [] // Simplified for now
      });
    }

    // Get recent sessions, ordered by lastActive
    const sessions = await ChatHistory.getActiveSessions(limit);

    const formattedSessions = sessions.map((session) => {
      const existingSummary = session.data.summary;
      const hasMessages = session.data.messages.length > 0;
      const quickSummary = existingSummary || (hasMessages ? getQuickSummary(session.data.messages) : 'No summary available');

      if (!existingSummary && hasMessages) {
        void queueAsyncSummaryGeneration(session.sessionId, session.data.messages);
      }

      const displayName = session.data.sessionName || quickSummary || 'Untitled Session';

      return {
        sessionId: session.sessionId,
        name: displayName,
        summary: quickSummary || 'No summary available',
        messageCount: session.data.messages.length,
        startedAt: session.startedAt,
        lastActive: session.lastActive || session.startedAt,
        isActive: session.sessionId === searchParams.get('currentSessionId')
      };
    });

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

    let updatedSession;

    if (sessionName) {
      // Update session name
      updatedSession = await ChatHistory.updateSessionName(sessionId, sessionName);
    } else if (updateLastActive) {
      // Update last active timestamp
      updatedSession = await ChatHistory.updateLastActive(sessionId);
    } else {
      return NextResponse.json(
        { error: 'No update parameters provided' },
        { status: 400 }
      );
    }

    if (!updatedSession) {
      return NextResponse.json(
        { error: 'Session not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        sessionId: updatedSession.sessionId,
        sessionName: updatedSession.data.sessionName,
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

    // Database connection handled by model

    // For now, just mark as abandoned - could implement actual deletion in model
    const deletedSession = await ChatHistory.endSession(sessionId, 'abandoned');

    if (!deletedSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session ended successfully'
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
async function generateSessionSummary(session: { messages: Array<{ role: string; content: string }> }): Promise<string> {
  try {
    // Get first few user messages to understand the topic
    const userMessages = session.messages
      .filter((m) => m.role === 'user')
      .slice(0, 3)
      .map((m) => m.content)
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
      const sessionConfig = getSessionManagementConfig();
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const response = await executeWithTimeout(
        (signal) => openai.chat.completions.create({
          model: sessionConfig.summary_model,
          messages: [
            { role: 'system', content: 'You are a concise summarizer. Provide very brief 3-5 word summaries.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: sessionConfig.summary_max_tokens
        }, { signal }),
        SESSION_SUMMARY_TIMEOUT_MS,
        'AI_SESSION_SUMMARY_TIMEOUT'
      );

      const summary = response.choices[0]?.message?.content?.trim() || 'Conversation';
      return summary.replace(/['"]/g, ''); // Remove quotes if any
    } catch (aiError) {
      if (aiError instanceof TimeoutError && aiError.message === 'AI_SESSION_SUMMARY_TIMEOUT') {
        console.warn('Session summary generation timed out');
      } else {
        console.warn('Failed to generate AI summary:', aiError);
      }
      // Fallback to extracting key words from first message
      const firstWords = userMessages.split(' ').slice(0, 5).join(' ');
      return firstWords.length > 30 ? firstWords.substring(0, 30) + '...' : firstWords;
    }
  } catch (error) {
    console.error('Error in generateSessionSummary:', error);
    return 'Conversation';
  }
}
