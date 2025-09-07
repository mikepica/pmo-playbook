import { ChatOpenAI } from '@langchain/openai';
import { WorkflowState, StateHelpers, SourceValidationResult } from '../state';
import { HumanSOP } from '@/models/HumanSOP';
import { getAIConfig, getPrompt, debugLog } from '../../ai-config';

/**
 * Source Validation Node
 * Cross-references multiple SOPs for consistency when medium confidence 
 * with potential conflicts exists
 */
export async function sourceValidationNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  
  try {
    debugLog('log_xml_processing', 'Starting source validation node', {
      sopCount: state.sopReferences.length,
      confidence: state.confidence,
      gaps: state.coverageAnalysis.gaps.length
    });

    // Only validate sources for medium confidence with multiple SOPs and gaps
    if (state.coverageAnalysis.responseStrategy !== 'partial_answer' || 
        state.sopReferences.length < 2 ||
        state.coverageAnalysis.gaps.length === 0) {
      debugLog('log_xml_processing', 'Skipping source validation - conditions not met', {
        strategy: state.coverageAnalysis.responseStrategy,
        sopCount: state.sopReferences.length,
        gapCount: state.coverageAnalysis.gaps.length
      });
      
      return {
        ...StateHelpers.markNodeComplete(state, 'sourceValidation'),
        currentNode: 'responseGeneration'
      };
    }

    const config = getAIConfig();
    const systemPrompt = getPrompt('system_base');

    // Get related SOPs for cross-referencing
    const primarySop = state.sopReferences[0];
    const crossReferenceSops = state.sopReferences.slice(1, 4); // Up to 3 additional SOPs

    // Fetch full content for validation
    const sopContents = await Promise.all([
      { ref: primarySop, type: 'primary' },
      ...crossReferenceSops.map(ref => ({ ref, type: 'cross-reference' as const }))
    ].map(async ({ ref, type }) => {
      try {
        const sop = await HumanSOP.findBySopId(ref.sopId);
        return {
          type,
          sopId: ref.sopId,
          title: ref.title,
          content: sop?.data.markdownContent || '',
          confidence: ref.confidence,
          sections: ref.sections,
          keyPoints: ref.keyPoints
        };
      } catch {
        return null;
      }
    }));

    const validSops = sopContents.filter(sop => sop !== null);
    const primarySopContent = validSops.find(sop => sop.type === 'primary');
    const crossRefSops = validSops.filter(sop => sop.type === 'cross-reference');

    if (!primarySopContent || crossRefSops.length === 0) {
      return {
        ...StateHelpers.markNodeComplete(state, 'sourceValidation'),
        currentNode: 'responseGeneration'
      };
    }

    // Create validation prompt
    const validationPrompt = `
You are a PMO expert performing source validation and cross-referencing.

Query: "${state.query}"
Intent: "${state.coverageAnalysis.queryIntent}"
Identified Gaps: ${state.coverageAnalysis.gaps.join(', ')}

PRIMARY SOP (${primarySopContent.confidence.toFixed(2)} confidence):
${primarySopContent.sopId} - ${primarySopContent.title}
Key Points: ${primarySopContent.keyPoints.join(', ')}
Relevant Sections: ${primarySopContent.sections.join(', ')}
Content: ${primarySopContent.content.substring(0, 1200)}...

CROSS-REFERENCE SOPs:
${crossRefSops.map(sop => `
${sop.sopId} - ${sop.title} (${sop.confidence.toFixed(2)} confidence)
Key Points: ${sop.keyPoints.join(', ')}
Content: ${sop.content.substring(0, 800)}...
`).join('\n---\n')}

Please analyze:
1. Consistency between the primary SOP and cross-reference SOPs
2. Any conflicts or contradictions in procedures/guidance
3. Coverage gaps that could be filled by combining information
4. Recommendations for improving response accuracy

Respond in this format:

CONSISTENCY_SCORE: [0.0-1.0]

CONFLICTS:
- [Specific conflict description]
- [Another conflict if any]

COVERAGE_IMPROVEMENTS:
- [How cross-references help fill gaps]
- [Additional insights available]

RECOMMENDATIONS:
- [Specific recommendations for response generation]

CONFIDENCE_ADJUSTMENT: [INCREASE/DECREASE/MAINTAIN] - [reason]
`;

    const llm = new ChatOpenAI({
      modelName: config.processing?.model || 'gpt-4o',
      temperature: 0.2, // Low temperature for analytical work
      maxTokens: 2000
    });

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: validationPrompt }
    ]);

    const validationContent = response.content as string;
    
    if (!validationContent) {
      throw new Error('No response from AI for source validation');
    }

    // Parse validation results
    const validationResult = parseSourceValidationResults(
      validationContent, 
      primarySopContent.sopId,
      crossRefSops.map(sop => sop.sopId)
    );

    // Adjust confidence based on validation results
    let adjustedConfidence = state.confidence;
    let adjustmentReason = 'Source validation completed';

    if (validationResult.consistencyScore < 0.6) {
      adjustedConfidence = Math.max(state.confidence * 0.7, 0.3);
      adjustmentReason = 'Source validation found significant inconsistencies';
    } else if (validationResult.consistencyScore > 0.8 && validationResult.conflicts.length === 0) {
      adjustedConfidence = Math.min(state.confidence + 0.1, 0.9);
      adjustmentReason = 'Source validation confirmed high consistency';
    } else if (validationResult.conflicts.length > 0) {
      adjustedConfidence = Math.max(state.confidence * 0.85, 0.4);
      adjustmentReason = 'Source validation identified conflicts requiring clarification';
    }

    // Update coverage analysis with validation insights
    const updatedCoverageAnalysis = {
      ...state.coverageAnalysis,
      overallConfidence: adjustedConfidence,
      gaps: [
        ...state.coverageAnalysis.gaps,
        ...validationResult.conflicts.map(conflict => `Conflict: ${conflict}`)
      ].slice(0, 5) // Limit total gaps
    };

    // Update state with LLM call metadata
    const updatedState = StateHelpers.addLLMCall(state, {
      node: 'sourceValidation',
      model: config.processing?.model || 'gpt-4o',
      tokensIn: estimateTokens(validationPrompt),
      tokensOut: estimateTokens(validationContent),
      latency: Date.now() - startTime,
      success: true
    });

    const finalState = StateHelpers.addConfidenceEntry(
      updatedState,
      'sourceValidation',
      adjustedConfidence,
      adjustmentReason
    );

    debugLog('log_xml_processing', 'Source validation completed', {
      consistencyScore: validationResult.consistencyScore,
      conflicts: validationResult.conflicts.length,
      recommendations: validationResult.recommendations.length,
      adjustedConfidence,
      duration: Date.now() - startTime
    });

    return {
      ...StateHelpers.markNodeComplete(finalState, 'sourceValidation'),
      sourceValidationResults: [validationResult],
      confidence: adjustedConfidence,
      coverageAnalysis: updatedCoverageAnalysis,
      currentNode: 'responseGeneration'
    };

  } catch (error) {
    console.error('Error in source validation node:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in source validation';
    
    // Continue without validation on error
    return {
      ...StateHelpers.addError(state, `Source validation failed: ${errorMessage}`),
      ...StateHelpers.markNodeComplete(state, 'sourceValidation'),
      currentNode: 'responseGeneration'
    };
  }
}

/**
 * Parse source validation results from AI response
 */
function parseSourceValidationResults(
  content: string, 
  primarySopId: string, 
  crossReferenceSopIds: string[]
): SourceValidationResult {
  const result: SourceValidationResult = {
    primarySopId,
    crossReferenceSopIds,
    consistencyScore: 0.5, // Default
    conflicts: [],
    recommendations: []
  };

  try {
    // Extract consistency score
    const consistencyMatch = content.match(/CONSISTENCY_SCORE:\s*([0-9.]+)/i);
    if (consistencyMatch) {
      result.consistencyScore = Math.min(Math.max(parseFloat(consistencyMatch[1]), 0), 1);
    }

    // Extract conflicts
    const conflictsSection = content.match(/CONFLICTS:(.*?)(?=COVERAGE_IMPROVEMENTS:|RECOMMENDATIONS:|$)/is);
    if (conflictsSection) {
      const conflictLines = conflictsSection[1].split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0);
      result.conflicts = conflictLines;
    }

    // Extract recommendations
    const recommendationsSection = content.match(/RECOMMENDATIONS:(.*?)(?=CONFIDENCE_ADJUSTMENT:|$)/is);
    if (recommendationsSection) {
      const recommendationLines = recommendationsSection[1].split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0);
      result.recommendations = recommendationLines;
    }

  } catch (error) {
    console.error('Error parsing source validation results:', error);
  }

  return result;
}

/**
 * Simple token estimation function
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}