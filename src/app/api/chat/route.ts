import { NextResponse } from 'next/server';
import { 
  selectBestSOPs, 
  generateMultiSOPAnswer, 
  generateGeneralAnswer,
  processQueryWithMode,
  processQueryWithAutoEscalation,
  handleContextOverflow
} from '@/lib/ai-sop-selection-v2';
import { 
  getAIConfig, 
  debugLog, 
  isFeatureEnabled,
  getDefaultResponseMode,
  isChainOfThoughtEnabled
} from '@/lib/ai-config';
import { ChatHistory } from '@/models/ChatHistory';

export async function POST(request: Request) {
  try {
    const { message, sessionId, responseMode, forceComprehensive } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Database connection handled by model

    // Generate or use provided session ID
    const currentSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Load AI configuration
    const aiConfig = getAIConfig();
    
    // Get conversation context from existing chat history
    let conversationContext: Array<{role: 'user' | 'assistant', content: string}> = [];
    try {
      const existingChat = await ChatHistory.findBySessionId(currentSessionId);
      if (existingChat && existingChat.data.messages.length > 0) {
        // Get all messages for context management
        conversationContext = existingChat.data.messages
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }));
      }
    } catch (contextError) {
      console.warn('Failed to load conversation context:', contextError);
      // Continue without context
    }

    // Determine response mode
    const requestedMode = responseMode || getDefaultResponseMode();
    const useComprehensive = forceComprehensive || requestedMode === 'comprehensive';
    
    debugLog('log_response_modes', 'Processing query with enhanced system', { 
      message, 
      sessionId: currentSessionId,
      requestedMode,
      forceComprehensive
    });

    // Use enhanced processing with context overflow handling
    let result;
    if (conversationContext.length > 0) {
      // Handle potential context overflow
      result = await handleContextOverflow(message, conversationContext, requestedMode);
    } else {
      // New conversation - use standard processing
      if (useComprehensive) {
        result = await processQueryWithMode(message, 'comprehensive', conversationContext, true);
      } else {
        result = await processQueryWithAutoEscalation(message, conversationContext, requestedMode);
      }
    }

    const answerResult = {
      answer: result.answer,
      confidence: result.confidence,
      responseMode: useComprehensive ? 'comprehensive' : requestedMode,
      usedChainOfThought: result.reasoning ? true : false,
      sopSources: result.sopSources || [],
      reasoning: result.reasoning
    };
    
    debugLog('log_token_usage', 'Enhanced answer generation completed', {
      answerLength: answerResult.answer.length,
      sopCount: answerResult.sopSources.length,
      usedChainOfThought: answerResult.usedChainOfThought
    });

    // Save or update chat history
    try {
      const existingChat = await ChatHistory.findBySessionId(currentSessionId);
      
      if (existingChat) {
        // Add user message
        await ChatHistory.addMessage(currentSessionId, {
          role: 'user',
          content: message
        });
        
        // Add assistant message with enhanced support
        await ChatHistory.addMessage(currentSessionId, {
          role: 'assistant',
          content: answerResult.answer,
          selectedSopId: answerResult.sopSources.length === 1 ? answerResult.sopSources[0] : answerResult.sopSources.join(','),
          confidence: answerResult.confidence
        });
      } else {
        // Create new chat session
        const newChat = await ChatHistory.createSession(currentSessionId);
        
        // Add user message
        await ChatHistory.addMessage(currentSessionId, {
          role: 'user',
          content: message
        });
        
        // Add assistant message with enhanced support
        await ChatHistory.addMessage(currentSessionId, {
          role: 'assistant',
          content: answerResult.answer,
          selectedSopId: answerResult.sopSources.length === 1 ? answerResult.sopSources[0] : answerResult.sopSources.join(','),
          confidence: answerResult.confidence
        });
      }
    } catch (historyError) {
      console.warn('Failed to save chat history:', historyError);
      // Continue processing even if history save fails
    }

    // AI-generated proposal logic removed as part of Step 6.5: Simplify to User Feedback System
    // Only user-initiated feedback will create proposals going forward

    // Return enhanced response with full attribution
    return NextResponse.json({
      response: answerResult.answer,
      sessionId: currentSessionId,
      attribution: {
        selectedSOP: {
          sopId: answerResult.sopSources[0] || 'MULTIPLE',
          title: answerResult.sopSources.length === 1 ? 'Single SOP' : 'Multiple SOPs'
        },
        confidence: answerResult.confidence,
        responseMode: answerResult.responseMode,
        usedChainOfThought: answerResult.usedChainOfThought,
        sopSources: answerResult.sopSources,
        reasoning: answerResult.reasoning ? {
          steps: answerResult.reasoning.reasoning_steps.length,
          totalTokens: answerResult.reasoning.total_tokens_used,
          duration: answerResult.reasoning.total_duration_ms,
          refinement: answerResult.reasoning.refinement_iterations ? {
            iterations: answerResult.reasoning.refinement_iterations.length,
            finalImprovement: answerResult.reasoning.refinement_iterations.length > 0 ? 
              answerResult.reasoning.refinement_iterations[answerResult.reasoning.refinement_iterations.length - 1].improvement : 0
          } : undefined
        } : undefined
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