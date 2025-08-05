import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ChatHistory from '@/models/ChatHistory';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'SessionId is required' }, { status: 400 });
    }

    await connectToDatabase();

    // Get chat history for the session
    const chatHistory = await ChatHistory.findOne({ sessionId }).sort({ createdAt: -1 });
    
    if (!chatHistory) {
      return NextResponse.json({ 
        messages: [],
        sessionId,
        exists: false
      });
    }

    return NextResponse.json({
      messages: chatHistory.messages,
      sessionId: chatHistory.sessionId,
      sopUsage: chatHistory.sopUsage,
      startedAt: chatHistory.startedAt,
      exists: true
    });

  } catch (error) {
    console.error('Chat history retrieval error:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve chat history' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { sessionId, message, type, attribution } = await request.json();
    
    if (!sessionId || !message || !type) {
      return NextResponse.json({ 
        error: 'SessionId, message, and type are required' 
      }, { status: 400 });
    }

    await connectToDatabase();

    // Find existing chat history or create new one
    let chatHistory = await ChatHistory.findOne({ sessionId });
    
    const newMessage = {
      role: type,
      content: message,
      timestamp: new Date(),
      selectedSopId: attribution?.selectedSOP?.sopId,
      confidence: attribution?.confidence
    };

    if (chatHistory) {
      // Add message to existing history
      chatHistory.messages.push(newMessage);
      await chatHistory.save();
    } else {
      // Create new chat history
      chatHistory = await ChatHistory.create({
        sessionId,
        messages: [newMessage],
        startedAt: new Date()
      });
    }

    return NextResponse.json({ 
      success: true,
      messageCount: chatHistory.messages.length
    });

  } catch (error) {
    console.error('Chat history save error:', error);
    return NextResponse.json({ 
      error: 'Failed to save chat history' 
    }, { status: 500 });
  }
}

// GET all active sessions (for admin/debugging)
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    await connectToDatabase();

    const activeSessions = await ChatHistory.getActiveSessions(limit);
    
    return NextResponse.json({
      sessions: activeSessions.map(session => ({
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        messageCount: session.messages.length,
        lastMessage: session.messages[session.messages.length - 1]?.content?.substring(0, 100)
      }))
    });

  } catch (error) {
    console.error('Active sessions retrieval error:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve active sessions' 
    }, { status: 500 });
  }
}