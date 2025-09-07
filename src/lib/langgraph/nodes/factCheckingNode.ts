import { ChatOpenAI } from '@langchain/openai';
import { WorkflowState, StateHelpers, FactCheckResult } from '../state';
import { HumanSOP } from '@/models/HumanSOP';
import { getAIConfig, getPrompt, debugLog } from '../../ai-config';

/**
 * Fact Checking Node
 * Validates SOP information before synthesis for high-confidence responses
 * Ensures accuracy when multiple SOPs are referenced
 */
export async function factCheckingNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  
  try {
    debugLog('log_xml_processing', 'Starting fact checking node', {
      sopCount: state.sopReferences.length,
      confidence: state.confidence,
      strategy: state.coverageAnalysis.responseStrategy
    });

    // Only fact-check for high confidence responses with multiple SOPs
    if (state.coverageAnalysis.responseStrategy !== 'full_answer' || 
        state.sopReferences.length < 2) {
      debugLog('log_xml_processing', 'Skipping fact checking - conditions not met', {
        strategy: state.coverageAnalysis.responseStrategy,
        sopCount: state.sopReferences.length
      });
      
      return {
        ...StateHelpers.markNodeComplete(state, 'factChecking'),
        currentNode: 'responseGeneration'
      };
    }

    const config = getAIConfig();
    const systemPrompt = getPrompt('system_base');

    // Get full content for fact-checking
    const sopContents = await Promise.all(
      state.sopReferences.slice(0, 3).map(async (ref) => { // Limit to top 3 SOPs
        try {
          const sop = await HumanSOP.findBySopId(ref.sopId);
          return {
            sopId: ref.sopId,
            title: ref.title,
            content: sop?.data.markdownContent || '',
            confidence: ref.confidence,
            keyPoints: ref.keyPoints
          };
        } catch {
          return null;
        }
      })
    );

    const validSops = sopContents.filter(sop => sop !== null);
    
    if (validSops.length < 2) {
      return {
        ...StateHelpers.markNodeComplete(state, 'factChecking'),
        currentNode: 'responseGeneration'
      };
    }

    // Extract key claims from SOPs for fact-checking
    const factCheckPrompt = `
You are a PMO expert performing fact-checking on Standard Operating Procedures.

Query: "${state.query}"
Intent: "${state.coverageAnalysis.queryIntent}"

Please fact-check the following SOPs for consistency and accuracy:

${validSops.map(sop => `
SOP ${sop.sopId} - ${sop.title}:
Key Points: ${sop.keyPoints.join(', ')}
Content: ${sop.content.substring(0, 1500)}...
`).join('\n---\n')}

For each SOP, identify:
1. Key claims or procedures described
2. Any conflicts or inconsistencies between SOPs
3. Verification of factual accuracy
4. Overall reliability assessment

Respond in this format:
SOP-ID: [Claim] - VERIFIED/QUESTIONABLE/CONFLICT
- Details: [explanation]
- Confidence: [0.0-1.0]

Focus on identifying any contradictory information that could affect the response quality.
`;

    const llm = new ChatOpenAI({
      modelName: config.processing?.model || 'gpt-4o',
      temperature: 0.1, // Low temperature for fact-checking
      maxTokens: 2000
    });

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: factCheckPrompt }
    ]);

    const factCheckContent = response.content as string;
    
    if (!factCheckContent) {
      throw new Error('No response from AI for fact checking');
    }

    // Parse fact-check results
    const factCheckResults = parseFactCheckResults(factCheckContent, validSops);
    
    // Calculate overall fact-check confidence
    const avgFactCheckConfidence = factCheckResults.length > 0
      ? factCheckResults.reduce((acc, result) => acc + result.confidence, 0) / factCheckResults.length
      : 1.0;

    // Adjust overall confidence based on fact-checking
    let adjustedConfidence = state.confidence;
    let adjustmentReason = '';

    if (avgFactCheckConfidence < 0.7) {
      adjustedConfidence = Math.max(state.confidence * 0.8, 0.4); // Reduce confidence
      adjustmentReason = 'Fact-checking revealed potential inconsistencies';
    } else if (avgFactCheckConfidence > 0.9) {
      adjustedConfidence = Math.min(state.confidence + 0.05, 1.0); // Slight boost
      adjustmentReason = 'Fact-checking confirmed high accuracy';
    } else {
      adjustmentReason = 'Fact-checking completed with acceptable results';
    }

    // Update state with LLM call metadata
    const updatedState = StateHelpers.addLLMCall(state, {
      node: 'factChecking',
      model: config.processing?.model || 'gpt-4o',
      tokensIn: estimateTokens(factCheckPrompt),
      tokensOut: estimateTokens(factCheckContent),
      latency: Date.now() - startTime,
      success: true
    });

    const finalState = StateHelpers.addConfidenceEntry(
      updatedState,
      'factChecking',
      adjustedConfidence,
      adjustmentReason
    );

    debugLog('log_xml_processing', 'Fact checking completed', {
      factCheckResults: factCheckResults.length,
      avgConfidence: avgFactCheckConfidence,
      adjustedConfidence,
      duration: Date.now() - startTime
    });

    return {
      ...StateHelpers.markNodeComplete(finalState, 'factChecking'),
      factCheckResults,
      confidence: adjustedConfidence,
      currentNode: 'responseGeneration'
    };

  } catch (error) {
    console.error('Error in fact checking node:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in fact checking';
    
    // Continue without fact-checking on error
    return {
      ...StateHelpers.addError(state, `Fact checking failed: ${errorMessage}`),
      ...StateHelpers.markNodeComplete(state, 'factChecking'),
      currentNode: 'responseGeneration'
    };
  }
}

/**
 * Parse fact-check results from AI response
 */
function parseFactCheckResults(content: string, sops: any[]): FactCheckResult[] {
  const results: FactCheckResult[] = [];
  
  // Look for patterns like "SOP-123: [Claim] - VERIFIED"
  const lines = content.split('\n');
  let currentResult: Partial<FactCheckResult> | null = null;
  
  for (const line of lines) {
    const sopMatch = line.match(/SOP-([^:]+):\s*(.+?)\s*-\s*(VERIFIED|QUESTIONABLE|CONFLICT)/i);
    
    if (sopMatch) {
      // Save previous result if exists
      if (currentResult && currentResult.sopId) {
        results.push(currentResult as FactCheckResult);
      }
      
      const sopId = `SOP-${sopMatch[1]}`;
      const claim = sopMatch[2].trim();
      const status = sopMatch[3].toUpperCase();
      
      // Find matching SOP
      const matchingSop = sops.find(sop => sop.sopId === sopId);
      
      currentResult = {
        sopId,
        claim,
        verified: status === 'VERIFIED',
        confidence: status === 'VERIFIED' ? 0.9 : status === 'QUESTIONABLE' ? 0.6 : 0.3,
        source: matchingSop?.title || 'Unknown SOP'
      };
    } else if (currentResult) {
      // Look for details and confidence in subsequent lines
      const detailMatch = line.match(/Details?:\s*(.+)/i);
      const confidenceMatch = line.match(/Confidence:\s*([0-9.]+)/i);
      
      if (detailMatch) {
        currentResult.notes = detailMatch[1].trim();
      } else if (confidenceMatch) {
        currentResult.confidence = Math.min(Math.max(parseFloat(confidenceMatch[1]), 0), 1);
      }
    }
  }
  
  // Save last result
  if (currentResult && currentResult.sopId) {
    results.push(currentResult as FactCheckResult);
  }
  
  return results;
}

/**
 * Simple token estimation function
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}