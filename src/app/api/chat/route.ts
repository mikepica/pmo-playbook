import { NextResponse } from 'next/server';
import { streamJsonResponse } from '@/lib/http/streaming';
import { processQueryWithLangGraph } from '@/lib/langgraph-processor';
import { UnifiedQueryResult } from '@/lib/langgraph/state';
import { ChatHistory } from '@/models/ChatHistory';
import { config } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const { message, sessionId } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!config.openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const currentSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return streamJsonResponse(async () => {
      // Get conversation context from existing chat history (non-blocking if load fails)
      let conversationContext: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      try {
        const existingChat = await ChatHistory.findBySessionId(currentSessionId);
        if (existingChat && existingChat.data.messages.length > 0) {
          conversationContext = existingChat.data.messages
            .filter(msg => msg.role !== 'system')
            .map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content
            }));
        }
      } catch (contextError) {
        console.warn('Failed to load conversation context:', contextError);
      }

      console.log('Processing query with LangGraph system', {
        message,
        sessionId: currentSessionId,
        contextLength: conversationContext.length
      });

      const result: UnifiedQueryResult = await processQueryWithLangGraph(
        message,
        conversationContext,
        currentSessionId
      );

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
        selectedSOP:
          result.sopReferences.length > 0
            ? {
                sopId: result.sopReferences[0].sopId,
                title: result.sopReferences[0].title
              }
            : null,
        usedChainOfThought: false,
        reasoning: undefined,
        contextManaged: false,
        summaryGenerated: false
      };

      console.log('LangGraph processing completed', {
        answerLength: answerResult.answer.length,
        sopCount: answerResult.sopSources.length,
        coverageLevel: answerResult.coverageLevel,
        responseStrategy: answerResult.responseStrategy,
        processingTime: answerResult.processingTime
      });

      try {
        const existingChat = await ChatHistory.findBySessionId(currentSessionId);
        const sopIdForStorage =
          answerResult.sopSources.length > 0
            ? answerResult.sopSources.map(s => s.sopId).join(',')
            : null;

        if (existingChat) {
          await ChatHistory.addMessage(currentSessionId, {
            role: 'user',
            content: message
          });

          await ChatHistory.addMessage(currentSessionId, {
            role: 'assistant',
            content: answerResult.answer,
            selectedSopId: sopIdForStorage || undefined,
            confidence: answerResult.confidence
          });
        } else {
          await ChatHistory.createSession(currentSessionId);
          await ChatHistory.addMessage(currentSessionId, {
            role: 'user',
            content: message
          });
          await ChatHistory.addMessage(currentSessionId, {
            role: 'assistant',
            content: answerResult.answer,
            selectedSopId: sopIdForStorage || undefined,
            confidence: answerResult.confidence
          });
        }
      } catch (historyError) {
        console.warn('Failed to save chat history:', historyError);
      }

      return {
        body: {
          response: answerResult.answer,
          sessionId: currentSessionId,
          attribution: {
            selectedSOP:
              answerResult.selectedSOP || {
                sopId: 'NONE',
                title: 'No SOPs found'
              },
            confidence: answerResult.confidence,
            responseStrategy: answerResult.responseStrategy,
            coverageLevel: answerResult.coverageLevel,
            sopSources: answerResult.sopSources,
            gaps: answerResult.gaps,
            queryIntent: answerResult.queryIntent,
            keyTopics: answerResult.keyTopics,
            processingTime: answerResult.processingTime,
            tokensUsed: answerResult.tokensUsed,
            responseMode: 'langgraph',
            processor: 'LangGraph',
            usedChainOfThought: false,
            reasoning: undefined
          }
        }
      };
    }, {
      onError: (error: unknown) => {
        console.error('Chat API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('No SOPs available')) {
          return {
            body: {
              error: 'No Standard Operating Procedures are available. Please contact your administrator.',
              code: 'NO_SOPS_AVAILABLE'
            }
          };
        }

        if (errorMessage.includes('OpenAI')) {
          return {
            body: {
              error: 'AI service temporarily unavailable. Please try again.',
              code: 'AI_SERVICE_ERROR'
            }
          };
        }

        return {
          body: {
            error: 'An unexpected error occurred. Please try again.',
            code: 'INTERNAL_ERROR'
          }
        };
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
