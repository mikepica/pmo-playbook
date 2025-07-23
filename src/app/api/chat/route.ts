import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { selectBestSOP, generateAnswer } from '@/lib/ai-sop-selection';
import ChatHistory from '@/models/ChatHistory';

export async function POST(request: Request) {
  try {
    const { message, sessionId } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Connect to database
    await connectToDatabase();

    // Generate or use provided session ID
    const currentSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Step A: Tool Selection - AI selects the most relevant SOP
    console.log('Step A: Selecting best SOP for query:', message);
    const sopSelection = await selectBestSOP(message);
    console.log('Selected SOP:', sopSelection);

    // Get conversation context from existing chat history
    let conversationContext: Array<{role: 'user' | 'assistant', content: string}> = [];
    try {
      const existingChat = await ChatHistory.findOne({ sessionId: currentSessionId });
      if (existingChat && existingChat.messages.length > 0) {
        // Get last few messages for context (excluding current message)
        conversationContext = existingChat.messages.slice(-4).map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      }
    } catch (contextError) {
      console.warn('Failed to load conversation context:', contextError);
      // Continue without context
    }

    // Step B: Answer Generation - AI generates response using selected SOP
    console.log('Step B: Generating answer using SOP:', sopSelection.selectedSopId);
    const answerResult = await generateAnswer(message, sopSelection.selectedSopId, conversationContext);
    console.log('Generated answer length:', answerResult.answer.length);

    // Save or update chat history
    try {
      const chatHistory = await ChatHistory.findOne({ sessionId: currentSessionId });
      
      if (chatHistory) {
        // Add new messages to existing session
        await chatHistory.addMessage({
          role: 'user',
          content: message,
          timestamp: new Date()
        });
        
        await chatHistory.addMessage({
          role: 'assistant',
          content: answerResult.answer,
          timestamp: new Date(),
          selectedSopId: sopSelection.selectedSopId,
          confidence: sopSelection.confidence
        });
      } else {
        // Create new chat session
        const chatEntry = {
          sessionId: currentSessionId,
          messages: [
            {
              role: 'user' as const,
              content: message,
              timestamp: new Date()
            },
            {
              role: 'assistant' as const,
              content: answerResult.answer,
              timestamp: new Date(),
              selectedSopId: sopSelection.selectedSopId,
              confidence: sopSelection.confidence
            }
          ],
          metadata: {
            userAgent: request.headers.get('user-agent') || undefined
          },
          startedAt: new Date()
        };
        
        await ChatHistory.create(chatEntry);
      }
    } catch (historyError) {
      console.warn('Failed to save chat history:', historyError);
      // Continue processing even if history save fails
    }

    // AI-generated proposal logic removed as part of Step 6.5: Simplify to User Feedback System
    // Only user-initiated feedback will create proposals going forward

    // Return response with full attribution
    return NextResponse.json({
      response: answerResult.answer,
      sessionId: currentSessionId,
      attribution: {
        selectedSOP: {
          sopId: sopSelection.selectedSopId,
          title: answerResult.sourceInfo.title,
          phase: answerResult.sourceInfo.phase
        },
        confidence: sopSelection.confidence,
        reasoning: sopSelection.reasoning
      }
    });

  } catch (error: unknown) {
    console.error('Chat API error:', error);
    
    // Return user-friendly error based on error type
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('No SOPs available')) {
      return NextResponse.json({ 
        error: 'No Standard Operating Procedures are available. Please contact your administrator.',
        code: 'NO_SOPS_AVAILABLE'
      }, { status: 503 });
    }
    
    if (errorMessage.includes('OpenAI')) {
      return NextResponse.json({ 
        error: 'AI service temporarily unavailable. Please try again.',
        code: 'AI_SERVICE_ERROR'
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'An unexpected error occurred. Please try again.',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}