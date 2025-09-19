import { NextResponse } from 'next/server';
import { streamJsonResponse } from '@/lib/http/streaming';
import { ChatHistory } from '@/models/ChatHistory';
import { ChatOpenAI } from '@langchain/openai';
import { getModelName } from '@/lib/langgraph/gpt5-config';

const INLINE_SUMMARY_LIMIT = Number(process.env.SESSION_SUMMARY_INLINE_LIMIT ?? '3');
const SUMMARY_TIME_BUDGET_MS = Number(process.env.SESSION_SUMMARY_TIME_BUDGET_MS ?? '45000');
const KEEP_EXISTING_SUMMARY_PLACEHOLDER = 'Conversation';

// GET all sessions for the user (with summaries)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const analytics = searchParams.get('analytics');
    const currentSessionId = searchParams.get('currentSessionId');

    if (analytics === 'true') {
      const activeSessions = await ChatHistory.getActiveSessions(1000);
      const totalSessions = activeSessions.length;
      const totalMessages = activeSessions.reduce((sum, session) => sum + session.data.messages.length, 0);
      const avgMessagesPerSession = totalMessages / (totalSessions || 1);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sopUsageStats = await ChatHistory.getSOPUsageStats(sevenDaysAgo);
      const sopUsageFrequency = sopUsageStats.reduce((acc, stat) => ({ ...acc, [stat.sopId]: stat.totalUsage }), {});

      return NextResponse.json({
        totalSessions,
        totalMessages,
        avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
        sopUsageFrequency,
        recentActivity: []
      });
    }

    const handler = async () => {
      const sessions = await ChatHistory.getActiveSessions(limit);
      const formattedSessions: Array<{
        sessionId: string;
        name: string;
        summary: string;
        messageCount: number;
        startedAt: Date;
        lastActive: Date;
        isActive: boolean;
      }> = [];

      const startedAt = Date.now();
      let summariesGenerated = 0;

      for (const session of sessions) {
        let summary = session.data.summary;
        const messages = session.data.messages || [];

        if (
          !summary &&
          messages.length > 0 &&
          summariesGenerated < INLINE_SUMMARY_LIMIT &&
          Date.now() - startedAt < SUMMARY_TIME_BUDGET_MS
        ) {
          summariesGenerated += 1;
          try {
            summary = await generateSessionSummary({ messages });
            if (summary && summary !== KEEP_EXISTING_SUMMARY_PLACEHOLDER) {
              ChatHistory.updateSessionSummary(session.sessionId, summary).catch(err => {
                console.warn('Failed to persist session summary:', err);
              });
            }
          } catch (summaryError) {
            console.warn('Session summary generation failed:', summaryError);
          }
        }

        const fallbackSummary = buildFallbackSummary(messages);
        const resolvedSummary = summary && summary.trim().length > 0 ? summary : fallbackSummary;

        formattedSessions.push({
          sessionId: session.sessionId,
          name: session.data.sessionName || resolvedSummary || 'Untitled Session',
          summary: resolvedSummary || 'No summary available',
          messageCount: messages.length,
          startedAt: session.startedAt,
          lastActive: session.lastActive || session.startedAt,
          isActive: session.sessionId === currentSessionId
        });
      }

      return {
        body: {
          sessions: formattedSessions,
          total: formattedSessions.length
        }
      };
    };

    return streamJsonResponse(handler, {
      onError: (error: unknown) => {
        console.error('Error fetching sessions:', error);
        return {
          body: {
            error: 'Failed to fetch sessions'
          }
        };
      }
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
      // Use LangChain ChatOpenAI for consistency with rest of codebase
      const llm = new ChatOpenAI({
        modelName: getModelName()
      });

      const response = await llm.invoke([
        { role: 'system', content: 'You are a concise summarizer. Provide very brief 3-5 word summaries.' },
        { role: 'user', content: prompt }
      ]);

      const summary = (response.content as string)?.trim() || 'Conversation';
      return summary.replace(/['"]/g, '');
    } catch (aiError) {
      console.warn('Failed to generate AI summary:', aiError);
      return buildFallbackSummary(session.messages);
    }
  } catch (error) {
    console.error('Error in generateSessionSummary:', error);
    return buildFallbackSummary(session.messages);
  }
}

function buildFallbackSummary(messages: Array<{ role: string; content: string }>): string {
  if (!messages || messages.length === 0) {
    return 'No summary available';
  }

  const userMessage = messages.find(message => message.role === 'user') || messages[0];
  const content = userMessage?.content?.trim();

  if (!content) {
    return 'No summary available';
  }

  const normalized = content.replace(/\s+/g, ' ');
  return normalized.length > 60 ? `${normalized.substring(0, 60)}...` : normalized;
}
