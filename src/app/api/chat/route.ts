import { NextResponse } from 'next/server';
import { selectBestSOP, generateAnswer } from '@/lib/ai-sop-selection';
import { ChatHistory } from '@/models/ChatHistory';

export async function POST(request: Request) {
  try {
    const { message, sessionId } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Database connection handled by model

    // Generate or use provided session ID
    const currentSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Step A: Tool Selection - AI selects the most relevant SOP
    console.log('Step A: Selecting best SOP for query:', message);
    const sopSelection = await selectBestSOP(message);
    console.log('Selected SOP:', sopSelection);

    // Get conversation context from existing chat history
    let conversationContext: Array<{role: 'user' | 'assistant', content: string}> = [];
    try {
      const existingChat = await ChatHistory.findBySessionId(currentSessionId);
      if (existingChat && existingChat.data.messages.length > 0) {
        // Get last few messages for context (excluding current message)
        conversationContext = existingChat.data.messages
          .filter(msg => msg.role !== 'system')
          .slice(-4)
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
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
      const existingChat = await ChatHistory.findBySessionId(currentSessionId);
      
      if (existingChat) {
        // Add user message
        await ChatHistory.addMessage(currentSessionId, {
          role: 'user',
          content: message
        });
        
        // Add assistant message
        await ChatHistory.addMessage(currentSessionId, {
          role: 'assistant',
          content: answerResult.answer,
          selectedSopId: sopSelection.selectedSopId,
          confidence: sopSelection.confidence
        });
      } else {
        // Create new chat session
        const newChat = await ChatHistory.createSession(currentSessionId);
        
        // Add user message
        await ChatHistory.addMessage(currentSessionId, {
          role: 'user',
          content: message
        });
        
        // Add assistant message
        await ChatHistory.addMessage(currentSessionId, {
          role: 'assistant',
          content: answerResult.answer,
          selectedSopId: sopSelection.selectedSopId,
          confidence: sopSelection.confidence
        });
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