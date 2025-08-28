import { NextResponse } from 'next/server';
import { processQuery, UnifiedQueryResult } from '@/lib/unified-query-processor';
import { debugLog } from '@/lib/ai-config';
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

    // Generate or use provided session ID
    const currentSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get conversation context from existing chat history
    let conversationContext: Array<{role: 'user' | 'assistant', content: string}> = [];
    try {
      const existingChat = await ChatHistory.findBySessionId(currentSessionId);
      if (existingChat && existingChat.data.messages.length > 0) {
        // Get last 6 messages for context (3 exchanges)
        conversationContext = existingChat.data.messages
          .filter(msg => msg.role !== 'system')
          .slice(-6)  // Last 6 messages for context
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }));
      }
    } catch (contextError) {
      console.warn('Failed to load conversation context:', contextError);
      // Continue without context
    }

    debugLog('log_xml_processing', 'Processing query with unified system', { 
      message: message.substring(0, 100) + '...', 
      sessionId: currentSessionId,
      contextLength: conversationContext.length
    });

    // Use unified processing pipeline
    const result: UnifiedQueryResult = await processQuery(message, conversationContext);

    // Format response for API compatibility
    const answerResult = {
      answer: result.answer,
      confidence: result.coverageAnalysis.overallConfidence,
      responseStrategy: result.coverageAnalysis.responseStrategy,
      coverageLevel: result.coverageAnalysis.coverageLevel,
      sopSources: result.sopReferences.map(ref => ({
        sopId: ref.sopId,
        title: ref.title,
        confidence: ref.confidence,
        sections: ref.sections,
        keyPoints: ref.keyPoints
      })),
      processingTime: result.processingTime,
      tokensUsed: result.tokensUsed,
      gaps: result.coverageAnalysis.gaps,
      queryIntent: result.coverageAnalysis.queryIntent,
      keyTopics: result.coverageAnalysis.keyTopics,
      
      // Legacy fields for backward compatibility
      selectedSOP: result.sopReferences.length > 0 ? {
        sopId: result.sopReferences[0].sopId,
        title: result.sopReferences[0].title
      } : null,
      usedChainOfThought: false,  // No longer relevant in unified system
      reasoning: undefined,       // XML reasoning is internal
      contextManaged: false,
      summaryGenerated: false
    };
    
    debugLog('log_xml_processing', 'Unified processing completed', {
      answerLength: answerResult.answer.length,
      sopCount: answerResult.sopSources.length,
      coverageLevel: answerResult.coverageLevel,
      responseStrategy: answerResult.responseStrategy,
      processingTime: answerResult.processingTime
    });

    // Save or update chat history
    try {
      const existingChat = await ChatHistory.findBySessionId(currentSessionId);
      
      // Prepare SOP ID for storage (handle multiple SOPs)
      const sopIdForStorage = answerResult.sopSources.length > 0 
        ? answerResult.sopSources.map(s => s.sopId).join(',')
        : null;
      
      if (existingChat) {
        // Add user message
        await ChatHistory.addMessage(currentSessionId, {
          role: 'user',
          content: message
        });
        
        // Add assistant message with unified system data
        await ChatHistory.addMessage(currentSessionId, {
          role: 'assistant',
          content: answerResult.answer,
          selectedSopId: sopIdForStorage,
          confidence: answerResult.confidence
        });
      } else {
        // Create new chat session
        await ChatHistory.createSession(currentSessionId);
        
        // Add user message
        await ChatHistory.addMessage(currentSessionId, {
          role: 'user',
          content: message
        });
        
        // Add assistant message with unified system data
        await ChatHistory.addMessage(currentSessionId, {
          role: 'assistant',
          content: answerResult.answer,
          selectedSopId: sopIdForStorage,
          confidence: answerResult.confidence
        });
      }
    } catch (historyError) {
      console.warn('Failed to save chat history:', historyError);
      // Continue processing even if history save fails
    }

    // AI-generated proposal logic removed as part of Step 6.5: Simplify to User Feedback System
    // Only user-initiated feedback will create proposals going forward

    // Return unified response with attribution
    return NextResponse.json({
      response: answerResult.answer,
      sessionId: currentSessionId,
      attribution: {
        // Primary SOP for backward compatibility
        selectedSOP: answerResult.selectedSOP || {
          sopId: 'NONE',
          title: 'No SOPs found'
        },
        confidence: answerResult.confidence,
        
        // New unified system data
        responseStrategy: answerResult.responseStrategy,
        coverageLevel: answerResult.coverageLevel,
        sopSources: answerResult.sopSources,
        gaps: answerResult.gaps,
        queryIntent: answerResult.queryIntent,
        keyTopics: answerResult.keyTopics,
        processingTime: answerResult.processingTime,
        tokensUsed: answerResult.tokensUsed,
        
        // Legacy compatibility fields
        responseMode: 'unified',  // No longer relevant but kept for compatibility
        usedChainOfThought: false,
        reasoning: undefined
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