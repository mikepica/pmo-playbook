import { ChatOpenAI } from '@langchain/openai';
import { WorkflowState, StateHelpers } from '../state';
import { getAIConfig, getPrompt, debugLog } from '../../ai-config';

/**
 * Query Analysis Node
 * Replaces the query analysis portion of the XML parsing logic
 * Analyzes user intent and extracts key topics
 */
export async function queryAnalysisNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  
  try {
    debugLog('log_xml_processing', 'Starting query analysis node', { 
      query: state.query,
      sessionId: state.sessionId 
    });

    // Get configuration
    const config = getAIConfig();
    const systemPrompt = getPrompt('system_base');
    
    // Build context string if available
    const contextString = state.conversationContext.length > 0 
      ? `\n\nConversation Context:\n${state.conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    // Create query analysis prompt
    const analysisPrompt = `
Analyze this user query and provide a structured assessment:

User Query: "${state.query}"${contextString}

Please analyze and respond with the following information:
1. Intent: What is the user trying to accomplish?
2. Key Topics: What are the main concepts/topics involved?
3. Specificity Level: How specific or general is this request?
4. Context Requirements: Does this query need additional context to answer properly?

Respond in a clear, structured format.
`;

    // Make LLM call
    const llm = new ChatOpenAI({
      modelName: config.processing?.model || 'gpt-4o',
      temperature: config.processing?.temperature || 0.2,
      maxTokens: 1000
    });

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: analysisPrompt }
    ]);

    const analysisContent = response.content as string;
    
    if (!analysisContent) {
      throw new Error('No response from AI for query analysis');
    }

    // Parse the analysis (simplified parsing for now)
    const intent = extractSection(analysisContent, 'Intent') || state.query;
    const keyTopicsText = extractSection(analysisContent, 'Key Topics') || '';
    const keyTopics = keyTopicsText.split(',').map(t => t.trim()).filter(t => t);
    const specificityLevel = extractSection(analysisContent, 'Specificity Level') || 'Medium';

    // Calculate initial confidence based on query clarity
    const initialConfidence = calculateQueryConfidence(state.query, keyTopics.length, specificityLevel);

    // Update state
    const updatedState = StateHelpers.addLLMCall(state, {
      node: 'queryAnalysis',
      model: config.processing?.model || 'gpt-4o',
      tokensIn: estimateTokens(analysisPrompt),
      tokensOut: estimateTokens(analysisContent),
      latency: Date.now() - startTime,
      success: true
    });

    const finalState = StateHelpers.addConfidenceEntry(
      updatedState,
      'queryAnalysis',
      initialConfidence,
      'Initial query analysis confidence based on clarity and specificity'
    );

    debugLog('log_xml_processing', 'Query analysis completed', {
      intent,
      keyTopics,
      specificityLevel,
      confidence: initialConfidence,
      duration: Date.now() - startTime
    });

    return {
      ...StateHelpers.markNodeComplete(finalState, 'queryAnalysis'),
      coverageAnalysis: {
        ...state.coverageAnalysis,
        queryIntent: intent,
        keyTopics: keyTopics,
        overallConfidence: initialConfidence
      },
      currentNode: 'sopAssessment'
    };

  } catch (error) {
    console.error('Error in query analysis node:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in query analysis';
    
    return {
      ...StateHelpers.addError(state, `Query analysis failed: ${errorMessage}`),
      shouldRetry: state.retryCount < 2,
      retryCount: state.retryCount + 1
    };
  }
}

/**
 * Helper function to extract sections from analysis text
 */
function extractSection(text: string, sectionName: string): string | null {
  const patterns = [
    new RegExp(`${sectionName}:?\\s*([^\\n]+)`, 'i'),
    new RegExp(`\\d+\\.\\s*${sectionName}:?\\s*([^\\n]+)`, 'i'),
    new RegExp(`\\*\\*${sectionName}\\*\\*:?\\s*([^\\n]+)`, 'i')
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Calculate initial confidence based on query characteristics
 */
function calculateQueryConfidence(query: string, keyTopicCount: number, specificityLevel: string): number {
  let confidence = 0.3; // Base confidence

  // Query length factor
  const wordCount = query.split(/\s+/).length;
  if (wordCount > 5) confidence += 0.1;
  if (wordCount > 10) confidence += 0.1;

  // Key topics factor
  if (keyTopicCount > 1) confidence += 0.1;
  if (keyTopicCount > 3) confidence += 0.1;

  // Specificity factor
  if (specificityLevel.toLowerCase().includes('high')) confidence += 0.2;
  else if (specificityLevel.toLowerCase().includes('medium')) confidence += 0.1;

  // Question words indicate clear intent
  if (/\b(how|what|why|when|where|which|who)\b/i.test(query)) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Simple token estimation function
 */
function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}