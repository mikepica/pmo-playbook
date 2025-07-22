import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { selectBestSOP, generateAnswer } from '@/lib/ai-sop-selection';
import ChatHistory from '@/models/ChatHistory';
import ChangeProposal from '@/models/ChangeProposal';

// Helper function to determine change type based on the suggestion
function determineChangeType(suggestedChange: { change: string; rationale: string }): string {
  const changeText = suggestedChange.change.toLowerCase();
  const rationaleText = suggestedChange.rationale.toLowerCase();
  
  if (changeText.includes('add') || rationaleText.includes('missing') || rationaleText.includes('should include')) {
    return 'addition';
  } else if (changeText.includes('remove') || changeText.includes('delete')) {
    return 'deletion';
  } else if (changeText.includes('update') || changeText.includes('modify') || changeText.includes('change')) {
    return 'modification';
  } else {
    return 'clarification';
  }
}

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

    // Create change proposal if suggested
    if (answerResult.suggestedChange) {
      try {
        // Get the humanSopId from the selected AgentSOP
        const AgentSOP = (await import('@/models/AgentSOP')).default;
        const agentSOP = await AgentSOP.findOne({ sopId: sopSelection.selectedSopId }).select('humanSopId');
        
        if (!agentSOP || !agentSOP.humanSopId) {
          console.warn('Could not find humanSopId for SOP:', sopSelection.selectedSopId);
        } else {
          // Check for recent similar proposals
          const existingSimilar = await ChangeProposal.findOne({
            sopId: sopSelection.selectedSopId,
            'proposedChange.section': answerResult.suggestedChange.section,
            status: 'pending_review',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
          });

          if (existingSimilar) {
            // Update metrics on existing proposal
            existingSimilar.metrics.affectedUsersCount += 1;
            await existingSimilar.save();
            console.log('Updated existing proposal metrics:', existingSimilar.proposalId);
          } else {
            // Create new proposal
            const changeProposal = {
              sopId: sopSelection.selectedSopId,
              humanSopId: agentSOP.humanSopId,
              triggerQuery: message,
              conversationContext: {
                sessionId: currentSessionId,
                messages: conversationContext.concat([
                  { role: 'user', content: message }
                ]).slice(-5), // Keep last 5 messages for context
                timestamp: new Date()
              },
              proposedChange: {
                section: answerResult.suggestedChange.section,
                originalContent: 'Current content not captured', // TODO: Extract from SOP
                suggestedContent: answerResult.suggestedChange.change,
                changeType: determineChangeType(answerResult.suggestedChange),
                rationale: answerResult.suggestedChange.rationale
              },
              metrics: {
                confidenceScore: sopSelection.confidence,
                similarProposalsCount: 0,
                affectedUsersCount: 1
              }
            };

            await ChangeProposal.create(changeProposal);
            console.log('Change proposal created for SOP:', sopSelection.selectedSopId);
          }
        }
      } catch (proposalError) {
        console.warn('Failed to create change proposal:', proposalError);
        // Continue processing even if proposal creation fails
      }
    }

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
      },
      suggestedChange: answerResult.suggestedChange ? {
        detected: true,
        section: answerResult.suggestedChange.section
      } : null
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