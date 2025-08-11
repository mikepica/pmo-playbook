import { NextResponse } from 'next/server';
import { selectBestSOPs, generateMultiSOPAnswer, generateGeneralAnswer } from '@/lib/ai-sop-selection-v2';
import { getAIConfig, debugLog, isFeatureEnabled } from '@/lib/ai-config';
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

    // Load AI configuration
    const aiConfig = getAIConfig();
    
    // Step A: Multi-SOP Selection - AI selects the most relevant SOPs
    debugLog('log_sop_selection_reasoning', 'Starting SOP selection for query', { message, sessionId: currentSessionId });
    const sopSelection = await selectBestSOPs(message);
    debugLog('log_sop_selection_reasoning', 'SOP selection completed', sopSelection);

    // Get conversation context from existing chat history
    let conversationContext: Array<{role: 'user' | 'assistant', content: string}> = [];
    try {
      const existingChat = await ChatHistory.findBySessionId(currentSessionId);
      if (existingChat && existingChat.data.messages.length > 0) {
        // Get last few messages for context (excluding current message)
        const historyLimit = aiConfig.flow.conversation_history_limit;
        conversationContext = existingChat.data.messages
          .filter(msg => msg.role !== 'system')
          .slice(-historyLimit)
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }));
      }
    } catch (contextError) {
      console.warn('Failed to load conversation context:', contextError);
      // Continue without context
    }

    // Step B: Answer Generation - Use multi-SOP or general knowledge
    let answerResult;
    let selectedSopIds: string[] = [];
    
    if (sopSelection.strategy === 'general_knowledge') {
      debugLog('log_sop_selection_reasoning', 'Using general PM knowledge for answer generation');
      const generalResult = await generateGeneralAnswer(message, conversationContext);
      answerResult = {
        answer: generalResult.answer,
        sourceInfo: {
          sopId: 'GENERAL_PM_KNOWLEDGE',
          title: 'General PM Expertise'
        }
      };
      selectedSopIds = ['GENERAL_PM_KNOWLEDGE'];
    } else {
      debugLog('log_sop_selection_reasoning', 'Using multi-SOP answer generation', {
        sopCount: sopSelection.selectedSops.length,
        sopIds: sopSelection.selectedSops.map(s => s.sopId)
      });
      const multiResult = await generateMultiSOPAnswer(message, sopSelection, conversationContext);
      answerResult = {
        answer: multiResult.answer,
        sourceInfo: {
          sopId: sopSelection.selectedSops[0]?.sopId || 'UNKNOWN',
          title: multiResult.sopSources[0]?.sopId || 'Multiple SOPs'
        }
      };
      selectedSopIds = sopSelection.selectedSops.map(s => s.sopId);
    }
    
    debugLog('log_token_usage', 'Answer generation completed', {
      answerLength: answerResult.answer.length,
      sopCount: selectedSopIds.length
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
        
        // Add assistant message with multi-SOP support
        await ChatHistory.addMessage(currentSessionId, {
          role: 'assistant',
          content: answerResult.answer,
          selectedSopId: selectedSopIds.length === 1 ? selectedSopIds[0] : selectedSopIds.join(','),
          confidence: sopSelection.overallConfidence
        });
      } else {
        // Create new chat session
        const newChat = await ChatHistory.createSession(currentSessionId);
        
        // Add user message
        await ChatHistory.addMessage(currentSessionId, {
          role: 'user',
          content: message
        });
        
        // Add assistant message with multi-SOP support
        await ChatHistory.addMessage(currentSessionId, {
          role: 'assistant',
          content: answerResult.answer,
          selectedSopId: selectedSopIds.length === 1 ? selectedSopIds[0] : selectedSopIds.join(','),
          confidence: sopSelection.overallConfidence
        });
      }
    } catch (historyError) {
      console.warn('Failed to save chat history:', historyError);
      // Continue processing even if history save fails
    }

    // AI-generated proposal logic removed as part of Step 6.5: Simplify to User Feedback System
    // Only user-initiated feedback will create proposals going forward

    // Return response with multi-SOP attribution
    const primarySop = sopSelection.selectedSops.find(s => s.role === 'primary') || sopSelection.selectedSops[0];
    
    return NextResponse.json({
      response: answerResult.answer,
      sessionId: currentSessionId,
      attribution: {
        selectedSOP: {
          sopId: answerResult.sourceInfo.sopId,
          title: answerResult.sourceInfo.title
        },
        confidence: sopSelection.overallConfidence,
        reasoning: sopSelection.reasoning,
        // Enhanced attribution for multi-SOP
        strategy: sopSelection.strategy,
        sopSources: sopSelection.selectedSops.map(sop => ({
          sopId: sop.sopId,
          role: sop.role,
          confidence: sop.confidence
        }))
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