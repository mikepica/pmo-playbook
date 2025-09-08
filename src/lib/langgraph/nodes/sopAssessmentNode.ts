import { ChatOpenAI } from '@langchain/openai';
import { WorkflowState, StateHelpers, SOPReference } from '../state';
import { HumanSOP } from '@/models/HumanSOP';
import { getGPT5SystemPrompt, getModelName } from '../gpt5-config';

/**
 * SOP Assessment Node
 * Enhanced version of the XML SOP analysis logic
 * Analyzes SOPs for relevance and coverage of the query
 */
export async function sopAssessmentNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  
  try {
    console.log('Starting SOP assessment node', { 
      query: state.query,
      intent: state.coverageAnalysis.queryIntent,
      keyTopics: state.coverageAnalysis.keyTopics 
    });

    // Get all available SOPs and cache them for other nodes
    const humanSOPs = await HumanSOP.getAllActiveSOPs();
    
    if (humanSOPs.length === 0) {
      return {
        ...StateHelpers.addError(state, 'No SOPs available in database'),
        coverageAnalysis: {
          ...state.coverageAnalysis,
          overallConfidence: 0,
          coverageLevel: 'low',
          gaps: ['No SOPs available in database'],
          responseStrategy: 'escape_hatch'
        },
        currentNode: 'responseGeneration',
        shouldExit: true
      };
    }

    // Create SOP cache for performance optimization
    const sopCache = new Map(humanSOPs.map(sop => [sop.sopId, sop]));
    console.log('SOP cache created with', sopCache.size, 'SOPs:', Array.from(sopCache.keys()));

    // Build SOP summaries for analysis - send COMPLETE content
    const sopSummaries = humanSOPs.map(sop => {
      // Send the FULL content - no truncation at all
      const fullContent = sop.data.markdownContent;
      
      return `- SOP ID: ${sop.sopId}
   Title: "${sop.data.title}"
   Full Content: "${fullContent}"`;
    }).join('\n\n');

    // System prompt for SOP assessment
    const baseSystemPrompt = `You are an expert PMO consultant analyzing company SOPs for relevant content.

CRITICAL INSTRUCTIONS:
1. Search through each SOP for content matching the user's query
2. When you find relevant content, create an <sop> entry for it
3. ALWAYS generate <sop> tags when content is found, even if partially relevant
4. Set confidence based on how well the SOP answers the question
5. The user is looking for information that exists in the SOPs
6. If an SOP mentions project managers, roles, responsibilities - it's relevant!
7. Use XML structure exactly as specified - this is critical for parsing`;

    const systemPrompt = getGPT5SystemPrompt(baseSystemPrompt, { verbosity: 'high', reasoning: 'high' });

    const analysisPrompt = `Analyze the provided SOPs and determine their relevance to the user query. 

Respond with the following XML structure:
<analysis>
  <intent>What the user is trying to find out</intent>
  <key_topics>topic1, topic2, topic3</key_topics>
  
  <sop id="SOP-ID" confidence="0.0-1.0">
    <relevant_sections>Section names that apply</relevant_sections>
    <key_points>Key relevant points from this SOP</key_points>
    <applicability>How this SOP addresses the query</applicability>
  </sop>
  
  <overall_confidence>0.0-1.0</overall_confidence>
  <coverage_level>high|medium|low</coverage_level>
  <gaps>Any missing information</gaps>
  <response_strategy>full_answer|partial_answer|escape_hatch</response_strategy>
</analysis>`;
    
    // Build context string
    const contextString = state.conversationContext.length > 0 
      ? `\n\nConversation Context:\n${state.conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    const fullPrompt = `${analysisPrompt}

User Query: "${state.query}"
Intent: Find information about "${state.coverageAnalysis.queryIntent}"
Search for: ${state.coverageAnalysis.keyTopics.join(', ')}${contextString}

IMPORTANT: Generate <sop> entries for EVERY SOP that contains relevant information about the query.
If an SOP discusses project managers, their roles, or responsibilities, it MUST be included.

Available SOPs:
${sopSummaries}`;

    // Make AI call
    const llm = new ChatOpenAI({
      modelName: getModelName()
    });

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: fullPrompt }
    ]);

    const xmlContent = response.content as string;
    if (!xmlContent) {
      throw new Error('No response from AI for SOP assessment');
    }

    console.log('Received SOP assessment', { 
      contentLength: xmlContent.length,
      duration: Date.now() - startTime 
    });

    // Debug: Log the actual XML content to understand parsing issues
    console.log('Raw XML Response:', xmlContent.substring(0, 1000) + (xmlContent.length > 1000 ? '...' : ''));

    // Parse XML response using existing logic
    const { sopReferences, coverageAnalysis } = parseSOPAnalysisXML(xmlContent);

    // Fill in SOP titles from database
    for (const ref of sopReferences) {
      const sop = humanSOPs.find(s => s.sopId === ref.sopId);
      if (sop) {
        ref.title = sop.data.title;
      }
    }

    // Update state with LLM call metadata
    const updatedState = StateHelpers.addLLMCall(state, {
      node: 'sopAssessment',
      model: getModelName(),
      tokensIn: estimateTokens(fullPrompt),
      tokensOut: estimateTokens(xmlContent),
      latency: Date.now() - startTime,
      success: true
    });

    const finalState = StateHelpers.addConfidenceEntry(
      updatedState,
      'sopAssessment',
      coverageAnalysis.overallConfidence,
      `Found ${sopReferences.length} relevant SOPs with ${coverageAnalysis.coverageLevel} coverage`
    );

    console.log('SOP assessment complete', {
      overallConfidence: coverageAnalysis.overallConfidence,
      strategy: coverageAnalysis.responseStrategy,
      sopCount: sopReferences.length
    });

    return {
      ...StateHelpers.markNodeComplete(finalState, 'sopAssessment'),
      sopReferences,
      coverageAnalysis,
      cachedSOPs: sopCache,
      currentNode: 'coverageEvaluation'
    };

  } catch (error) {
    console.error('Error in SOP assessment node:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in SOP assessment';
    
    return {
      ...StateHelpers.addError(state, `SOP assessment failed: ${errorMessage}`),
      shouldRetry: state.retryCount < 2,
      retryCount: state.retryCount + 1,
      coverageAnalysis: {
        ...state.coverageAnalysis,
        overallConfidence: 0.1,
        coverageLevel: 'low',
        gaps: ['Error occurred during SOP analysis'],
        responseStrategy: 'escape_hatch'
      }
    };
  }
}

/**
 * Parse XML response from SOP analysis (copied from unified-query-processor)
 */
function parseSOPAnalysisXML(xmlResponse: string): {
  sopReferences: SOPReference[];
  coverageAnalysis: {
    overallConfidence: number;
    coverageLevel: 'high' | 'medium' | 'low';
    gaps: string[];
    responseStrategy: 'full_answer' | 'partial_answer' | 'escape_hatch';
    queryIntent: string;
    keyTopics: string[];
  };
} {
  try {
    console.log('Parsing XML response, length:', xmlResponse.length);
    
    // Clean up XML response - remove markdown code blocks if present
    let cleanXml = xmlResponse.trim();
    if (cleanXml.startsWith('```xml')) {
      cleanXml = cleanXml.replace(/^```xml\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (cleanXml.startsWith('```')) {
      cleanXml = cleanXml.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    
    console.log('Cleaned XML for parsing, length:', cleanXml.length);
    
    // Extract query analysis
    const queryIntentMatch = cleanXml.match(/<intent>(.*?)<\/intent>/);
    const keyTopicsMatch = cleanXml.match(/<key_topics>(.*?)<\/key_topics>/);
    
    const queryIntent = queryIntentMatch?.[1]?.trim() || 'Unknown intent';
    const keyTopics = keyTopicsMatch?.[1]?.trim().split(',').map(t => t.trim()) || [];

    console.log('Parsed query analysis:', { queryIntent, keyTopics });

    // Extract SOP references
    const sopReferenceRegex = /<sop id="([^"]+)" confidence="([^"]+)">([\s\S]*?)<\/sop>/g; // Use [\s\S] instead of 's' flag for compatibility
    const sopReferences: SOPReference[] = [];
    let sopMatch;
    let matchCount = 0;
    
    console.log('Looking for SOP matches in cleaned XML...');
    console.log('First 500 chars of cleanXml:', cleanXml.substring(0, 500));
    
    while ((sopMatch = sopReferenceRegex.exec(cleanXml)) !== null) {
      matchCount++;
      console.log(`Found SOP match ${matchCount}:`, sopMatch[1], sopMatch[2]);
      const sopId = sopMatch[1];
      const confidence = parseFloat(sopMatch[2]);
      const sopContent = sopMatch[3];
      
      const sectionsMatch = sopContent.match(/<relevant_sections>(.*?)<\/relevant_sections>/);
      const keyPointsMatch = sopContent.match(/<key_points>(.*?)<\/key_points>/);
      const applicabilityMatch = sopContent.match(/<applicability>(.*?)<\/applicability>/);
      
      sopReferences.push({
        sopId,
        title: '', // Will be filled from database
        sections: sectionsMatch?.[1]?.trim().split(',').map(s => s.trim()) || [],
        confidence,
        keyPoints: keyPointsMatch?.[1]?.trim().split(',').map(p => p.trim()) || [],
        applicability: applicabilityMatch?.[1]?.trim() || 'Unknown'
      });
    }

    // Extract coverage evaluation
    const overallConfidenceMatch = cleanXml.match(/<overall_confidence>(.*?)<\/overall_confidence>/);
    const coverageLevelMatch = cleanXml.match(/<coverage_level>(.*?)<\/coverage_level>/);
    const gapsMatch = cleanXml.match(/<gaps>(.*?)<\/gaps>/);
    const responseStrategyMatch = cleanXml.match(/<response_strategy>(.*?)<\/response_strategy>/);

    const overallConfidence = parseFloat(overallConfidenceMatch?.[1]?.trim() || '0');
    const coverageLevel = (coverageLevelMatch?.[1]?.trim() || 'low') as 'high' | 'medium' | 'low';
    const gaps = gapsMatch?.[1]?.trim().split(',').map(g => g.trim()).filter(g => g) || [];
    const responseStrategy = (responseStrategyMatch?.[1]?.trim() || 'escape_hatch') as 'full_answer' | 'partial_answer' | 'escape_hatch';

    const coverageAnalysis = {
      overallConfidence,
      coverageLevel,
      gaps,
      responseStrategy,
      queryIntent,
      keyTopics
    };

    console.log('XML parsing complete:', { 
      sopReferencesFound: sopReferences.length,
      overallConfidence,
      responseStrategy 
    });

    return { sopReferences, coverageAnalysis };

  } catch (error) {
    console.error('Error parsing XML response:', error);
    
    // Fallback to escape hatch on parsing errors
    return {
      sopReferences: [],
      coverageAnalysis: {
        overallConfidence: 0.1,
        coverageLevel: 'low' as const,
        gaps: ['Unable to analyze SOPs due to processing error'],
        responseStrategy: 'escape_hatch' as const,
        queryIntent: 'Unknown',
        keyTopics: []
      }
    };
  }
}

/**
 * Simple token estimation function
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}