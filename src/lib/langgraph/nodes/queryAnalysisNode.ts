import { ChatOpenAI } from '@langchain/openai';
import { WorkflowState, StateHelpers } from '../state';
import { getGPT5SystemPrompt, getModelName } from '../gpt5-config';
import { 
  loadSOPsWithTiming, 
  runInParallel, 
  isParallelProcessingEnabled,
  addParallelMetadata
} from '../parallel-utils';

/**
 * Query Analysis Node
 * Replaces the query analysis portion of the XML parsing logic
 * Analyzes user intent and extracts key topics
 */
export async function queryAnalysisNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  
  try {
    console.log('Starting query analysis node', { 
      query: state.query,
      sessionId: state.sessionId 
    });

    // System prompt for query analysis
    const baseSystemPrompt = `You are an expert PMO consultant. Your role is to analyze user queries to understand what information they need FROM THE COMPANY'S STANDARD OPERATING PROCEDURES (SOPs).

CRITICAL INSTRUCTIONS:
1. Identify what the user wants to find in the SOPs
2. Extract key topics that should be searched for in SOPs
3. Your intent should ALWAYS be to find relevant SOP content
4. Never assume the user wants general information - they want SOP-specific information
5. Focus on identifying searchable terms and concepts from SOPs`;

    const systemPrompt = getGPT5SystemPrompt(baseSystemPrompt, { verbosity: 'low', reasoning: 'medium' });
    
    // Build context string if available
    const contextString = state.conversationContext.length > 0 
      ? `\n\nConversation Context:\n${state.conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    // Create query analysis prompt
    const analysisPrompt = `
Analyze this user query to determine what SOP content should be searched:

User Query: "${state.query}"${contextString}

Please analyze and respond with:
1. Intent: What SOP information is the user looking for?
2. Key Topics: What specific terms/concepts should we search for in the SOPs?
3. Specificity Level: How specific is this request?
4. Context Requirements: What SOP sections would likely contain this information?

Remember: The user is asking about content that should be IN THE SOPs, not general knowledge.
Respond in a clear, structured format.
`;

    // Check if parallel processing is enabled
    const parallelEnabled = isParallelProcessingEnabled();
    
    if (parallelEnabled) {
      console.log('🚀 Parallel processing enabled - running query analysis and SOP loading concurrently');
      
      // Run query analysis and SOP loading in parallel
      const parallelResults = await runInParallel({
        queryAnalysis: performQueryAnalysis(systemPrompt, analysisPrompt),
        sopLoading: loadSOPsWithTiming()
      }, {
        timeout: 30000,
        failFast: false,
        logResults: true
      });
      
      // Extract results
      const queryResult = parallelResults.queryAnalysis;
      const sopResult = parallelResults.sopLoading;
      
      if (!queryResult.success) {
        throw queryResult.error || new Error('Query analysis failed');
      }
      
      const { intent, keyTopics, specificityLevel, initialConfidence, analysisContent } = queryResult.result;
      
      // Update state with both query analysis and SOP data
      let updatedState = StateHelpers.addLLMCall(state, {
        node: 'queryAnalysis',
        model: getModelName(),
        tokensIn: estimateTokens(analysisPrompt),
        tokensOut: estimateTokens(analysisContent),
        latency: queryResult.duration,
        success: true
      });
      
      updatedState = StateHelpers.addConfidenceEntry(
        updatedState,
        'queryAnalysis',
        initialConfidence,
        'Initial query analysis confidence based on clarity and specificity'
      );
      
      // Add parallel operation metadata
      const queryMeta = addParallelMetadata(updatedState, 'queryAnalysis', queryResult);
      const sopMeta = addParallelMetadata(updatedState, 'sopLoading', sopResult);
      
      // Combine metadata into final state
      const finalState = {
        ...updatedState,
        ...queryMeta,
        ...sopMeta,
        metadata: {
          ...updatedState.metadata,
          ...queryMeta.metadata,
          ...sopMeta.metadata,
          parallelOperations: [
            ...(updatedState.metadata.parallelOperations || []),
            ...(queryMeta.metadata?.parallelOperations || []),
            ...(sopMeta.metadata?.parallelOperations || [])
          ]
        }
      };
      
      console.log('✅ Parallel query analysis completed', {
        intent,
        keyTopics,
        specificityLevel,
        confidence: initialConfidence,
        queryDuration: queryResult.duration,
        sopDuration: sopResult.duration,
        totalDuration: Date.now() - startTime,
        sopLoadSuccess: sopResult.success
      });
      
      return {
        ...StateHelpers.markNodeComplete(finalState, 'queryAnalysis'),
        coverageAnalysis: {
          ...state.coverageAnalysis,
          queryIntent: intent,
          keyTopics: keyTopics,
          overallConfidence: initialConfidence
        },
        // Pre-load SOP data for next node if successful
        ...(sopResult.success ? {
          preloadedSOPs: sopResult.result,
          sopPreloadSuccess: true
        } : {
          sopPreloadSuccess: false
        }),
        currentNode: 'sopAssessment'
      };
      
    } else {
      // Sequential processing (original behavior)
      console.log('⏭️  Sequential processing - running query analysis only');
      
      const { intent, keyTopics, specificityLevel, initialConfidence, analysisContent } = 
        await performQueryAnalysis(systemPrompt, analysisPrompt);
      
      // Update state
      const updatedState = StateHelpers.addLLMCall(state, {
        node: 'queryAnalysis',
        model: getModelName(),
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

      console.log('Query analysis completed (sequential)', {
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
    }

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
 * Perform query analysis (can be run in parallel)
 */
async function performQueryAnalysis(
  systemPrompt: string, 
  analysisPrompt: string
): Promise<{
  intent: string;
  keyTopics: string[];
  specificityLevel: string;
  initialConfidence: number;
  analysisContent: string;
}> {
  // Make LLM call
  const llm = new ChatOpenAI({
    modelName: getModelName()
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
  const intent = extractSection(analysisContent, 'Intent') || 'Unknown intent';
  const keyTopicsText = extractSection(analysisContent, 'Key Topics') || '';
  const keyTopics = keyTopicsText.split(',').map(t => t.trim()).filter(t => t);
  const specificityLevel = extractSection(analysisContent, 'Specificity Level') || 'Medium';

  // Calculate initial confidence based on query clarity
  const initialConfidence = calculateQueryConfidence(intent, keyTopics.length, specificityLevel);

  return {
    intent,
    keyTopics,
    specificityLevel,
    initialConfidence,
    analysisContent
  };
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