import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ChatHistory from '@/models/ChatHistory';

// GET conversation thread for a session
export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const highlightMessageId = searchParams.get('highlightMessageId');
    
    await connectToDatabase();

    const session = await ChatHistory.findOne({ sessionId: params.sessionId });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Format messages for display
    const formattedMessages = session.messages.map((message: any, index: number) => ({
      id: message._id?.toString() || `msg-${index}`,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      selectedSopId: message.selectedSopId,
      confidence: message.confidence,
      isHighlighted: highlightMessageId ? 
        (message._id?.toString() === highlightMessageId || `msg-${index}` === highlightMessageId) : 
        false
    }));

    return NextResponse.json({
      sessionId: params.sessionId,
      sessionName: session.sessionName || 'Unnamed Session',
      summary: session.summary,
      messages: formattedMessages,
      startedAt: session.startedAt,
      lastActive: session.lastActive || session.updatedAt,
      messageCount: session.messages.length
    });

  } catch (error: unknown) {
    console.error('Error fetching conversation thread:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation thread' },
      { status: 500 }
    );
  }
}