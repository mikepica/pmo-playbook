import { ChatOpenAI } from '@langchain/openai';
import { WorkflowState, StateHelpers } from '../state';
import { SOPReference } from '../../unified-query-processor';
import { HumanSOP } from '@/models/HumanSOP';
import { getAIConfig, getPrompt, debugLog } from '../../ai-config';

/**
 * SOP Assessment Node
 * Enhanced version of the XML SOP analysis logic
 * Analyzes SOPs for relevance and coverage of the query
 */
export async function sopAssessmentNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  
  try {
    debugLog('log_xml_processing', 'Starting SOP assessment node', { 
      query: state.query,
      intent: state.coverageAnalysis.queryIntent,
      keyTopics: state.coverageAnalysis.keyTopics 
    });

    // Get all available SOPs
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

    // Build SOP summaries for analysis
    const sopSummaries = humanSOPs.map(sop => {
      const fullContent = sop.data.markdownContent
        .replace(/^#.*$/gm, '') // Remove headers
        .replace(/\n\s*\n/g, ' ') // Collapse whitespace
        .trim()
        .replace(/\s+/g, ' ');
      
      return `- SOP ID: ${sop.sopId}
   Title: "${sop.data.title}"
   Full Content: "${fullContent.substring(0, 1000)}..."`;
    }).join('\n\n');

    // Get configuration and prompts
    const config = getAIConfig();
    const systemPrompt = getPrompt('system_base');
    const analysisPrompt = getPrompt('sop_analysis_xml');
    
    // Build context string
    const contextString = state.conversationContext.length > 0 
      ? `\n\nConversation Context:\n${state.conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    const fullPrompt = `${analysisPrompt}

User Query: "${state.query}"
Query Intent: "${state.coverageAnalysis.queryIntent}"
Key Topics: ${state.coverageAnalysis.keyTopics.join(', ')}${contextString}

Available SOPs:
${sopSummaries}`;

    // Make AI call
    const llm = new ChatOpenAI({
      modelName: config.sop_selection?.model || config.processing?.model || 'gpt-4o',
      temperature: config.sop_selection?.temperature || config.processing?.temperature || 0.2,
      maxTokens: 8000
    });

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: fullPrompt }
    ]);

    const xmlContent = response.content as string;
    if (!xmlContent) {
      throw new Error('No response from AI for SOP assessment');
    }

    debugLog('log_xml_processing', 'Received SOP assessment', { 
      contentLength: xmlContent.length,
      duration: Date.now() - startTime 
    });

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
      model: config.sop_selection?.model || config.processing?.model || 'gpt-4o',
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

    debugLog('log_coverage_analysis', 'SOP assessment complete', {
      overallConfidence: coverageAnalysis.overallConfidence,
      strategy: coverageAnalysis.responseStrategy,
      sopCount: sopReferences.length
    });

    return {
      ...StateHelpers.markNodeComplete(finalState, 'sopAssessment'),
      sopReferences,
      coverageAnalysis,
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
  coverageAnalysis: any;
} {
  try {
    // Extract query analysis
    const queryIntentMatch = xmlResponse.match(/<intent>(.*?)<\/intent>/s);
    const keyTopicsMatch = xmlResponse.match(/<key_topics>(.*?)<\/key_topics>/s);
    
    const queryIntent = queryIntentMatch?.[1]?.trim() || 'Unknown intent';
    const keyTopics = keyTopicsMatch?.[1]?.trim().split(',').map(t => t.trim()) || [];

    // Extract SOP references
    const sopMatches = xmlResponse.matchAll(/<sop id="([^"]+)" confidence="([^"]+)">(.*?)<\/sop>/gs);
    const sopReferences: SOPReference[] = [];
    
    for (const match of sopMatches) {
      const sopId = match[1];
      const confidence = parseFloat(match[2]);
      const sopContent = match[3];
      
      const sectionsMatch = sopContent.match(/<relevant_sections>(.*?)<\/relevant_sections>/s);
      const keyPointsMatch = sopContent.match(/<key_points>(.*?)<\/key_points>/s);
      const applicabilityMatch = sopContent.match(/<applicability>(.*?)<\/applicability>/s);
      
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
    const overallConfidenceMatch = xmlResponse.match(/<overall_confidence>(.*?)<\/overall_confidence>/s);
    const coverageLevelMatch = xmlResponse.match(/<coverage_level>(.*?)<\/coverage_level>/s);
    const gapsMatch = xmlResponse.match(/<gaps>(.*?)<\/gaps>/s);
    const responseStrategyMatch = xmlResponse.match(/<response_strategy>(.*?)<\/response_strategy>/s);

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