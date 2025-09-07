import { WorkflowState, StateHelpers } from '../state';
import { getAIConfig, debugLog } from '../../ai-config';

/**
 * Coverage Evaluation Node
 * Determines response strategy based on confidence scores and coverage analysis
 * Routes to appropriate next steps (response generation, fact checking, etc.)
 */
export async function coverageEvaluationNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  
  try {
    debugLog('log_coverage_analysis', 'Starting coverage evaluation', {
      overallConfidence: state.coverageAnalysis.overallConfidence,
      coverageLevel: state.coverageAnalysis.coverageLevel,
      sopCount: state.sopReferences.length
    });

    const config = getAIConfig();
    const thresholds = config.processing?.coverage_thresholds || {
      high_confidence: 0.7,
      medium_confidence: 0.4,
      low_confidence: 0.4
    };

    // Evaluate coverage based on confidence scores and thresholds
    const evaluation = evaluateCoverage(
      state.coverageAnalysis.overallConfidence,
      state.sopReferences,
      thresholds,
      state.coverageAnalysis.gaps
    );

    // Determine next node based on coverage evaluation
    const nextNode = determineNextNode(evaluation, state);
    
    // Update coverage analysis with evaluation results
    const updatedCoverageAnalysis = {
      ...state.coverageAnalysis,
      ...evaluation,
      overallConfidence: Math.max(state.coverageAnalysis.overallConfidence, evaluation.adjustedConfidence)
    };

    // Add confidence entry for this evaluation
    const updatedState = StateHelpers.addConfidenceEntry(
      state,
      'coverageEvaluation',
      evaluation.adjustedConfidence,
      evaluation.evaluationReason
    );

    debugLog('log_coverage_analysis', 'Coverage evaluation complete', {
      originalConfidence: state.coverageAnalysis.overallConfidence,
      adjustedConfidence: evaluation.adjustedConfidence,
      strategy: evaluation.responseStrategy,
      nextNode: nextNode,
      reasons: evaluation.evaluationReason
    });

    return {
      ...StateHelpers.markNodeComplete(updatedState, 'coverageEvaluation'),
      coverageAnalysis: updatedCoverageAnalysis,
      confidence: evaluation.adjustedConfidence,
      currentNode: nextNode
    };

  } catch (error) {
    console.error('Error in coverage evaluation node:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in coverage evaluation';
    
    return {
      ...StateHelpers.addError(state, `Coverage evaluation failed: ${errorMessage}`),
      shouldRetry: state.retryCount < 2,
      retryCount: state.retryCount + 1,
      currentNode: 'responseGeneration' // Fall back to response generation
    };
  }
}

/**
 * Evaluate coverage based on confidence, SOPs, and gaps
 */
function evaluateCoverage(
  confidence: number,
  sopReferences: any[],
  thresholds: any,
  gaps: string[]
) {
  let adjustedConfidence = confidence;
  let coverageLevel: 'high' | 'medium' | 'low' = 'low';
  let responseStrategy: 'full_answer' | 'partial_answer' | 'escape_hatch' = 'escape_hatch';
  let evaluationReasons: string[] = [];

  // Base confidence evaluation
  if (confidence >= thresholds.high_confidence) {
    coverageLevel = 'high';
    responseStrategy = 'full_answer';
    evaluationReasons.push(`High confidence (${confidence.toFixed(2)})`);
  } else if (confidence >= thresholds.medium_confidence) {
    coverageLevel = 'medium';
    responseStrategy = 'partial_answer';
    evaluationReasons.push(`Medium confidence (${confidence.toFixed(2)})`);
  } else {
    coverageLevel = 'low';
    responseStrategy = 'escape_hatch';
    evaluationReasons.push(`Low confidence (${confidence.toFixed(2)})`);
  }

  // Adjust based on number of SOPs found
  if (sopReferences.length === 0) {
    adjustedConfidence = Math.min(adjustedConfidence, 0.2);
    responseStrategy = 'escape_hatch';
    evaluationReasons.push('No relevant SOPs found');
  } else if (sopReferences.length === 1) {
    // Single SOP - check its confidence
    const sopConfidence = sopReferences[0]?.confidence || 0;
    if (sopConfidence < 0.6) {
      adjustedConfidence = Math.min(adjustedConfidence, 0.5);
      evaluationReasons.push('Single SOP with low confidence');
    } else {
      evaluationReasons.push(`Single high-confidence SOP (${sopConfidence.toFixed(2)})`);
    }
  } else {
    // Multiple SOPs - boost confidence slightly
    const avgSopConfidence = sopReferences.reduce((acc, sop) => acc + (sop.confidence || 0), 0) / sopReferences.length;
    if (avgSopConfidence > 0.7) {
      adjustedConfidence = Math.min(adjustedConfidence + 0.1, 1.0);
      evaluationReasons.push(`Multiple high-confidence SOPs (avg: ${avgSopConfidence.toFixed(2)})`);
    } else {
      evaluationReasons.push(`Multiple SOPs with moderate confidence (avg: ${avgSopConfidence.toFixed(2)})`);
    }
  }

  // Adjust based on gaps
  if (gaps.length === 0) {
    adjustedConfidence = Math.min(adjustedConfidence + 0.05, 1.0);
    evaluationReasons.push('No coverage gaps identified');
  } else if (gaps.length > 3) {
    adjustedConfidence = Math.max(adjustedConfidence - 0.1, 0);
    evaluationReasons.push(`Multiple coverage gaps (${gaps.length})`);
  } else {
    evaluationReasons.push(`Some coverage gaps identified (${gaps.length})`);
  }

  // Re-evaluate strategy based on adjusted confidence
  if (adjustedConfidence >= thresholds.high_confidence) {
    coverageLevel = 'high';
    responseStrategy = 'full_answer';
  } else if (adjustedConfidence >= thresholds.medium_confidence) {
    coverageLevel = 'medium';
    responseStrategy = 'partial_answer';
  } else {
    coverageLevel = 'low';
    responseStrategy = 'escape_hatch';
  }

  return {
    adjustedConfidence,
    coverageLevel,
    responseStrategy,
    evaluationReason: evaluationReasons.join('; '),
    qualityMetrics: {
      sopCount: sopReferences.length,
      gapCount: gaps.length,
      avgSopConfidence: sopReferences.length > 0 
        ? sopReferences.reduce((acc, sop) => acc + (sop.confidence || 0), 0) / sopReferences.length 
        : 0,
      confidenceBoost: adjustedConfidence - confidence
    }
  };
}

/**
 * Determine next node based on coverage evaluation
 */
function determineNextNode(evaluation: any, state: WorkflowState): string {
  // For high confidence answers with multiple SOPs, consider fact checking
  if (evaluation.responseStrategy === 'full_answer' && 
      state.sopReferences.length > 1 && 
      evaluation.adjustedConfidence > 0.8) {
    return 'factChecking';
  }

  // For medium confidence with conflicting information, consider source validation
  if (evaluation.responseStrategy === 'partial_answer' && 
      evaluation.qualityMetrics.gapCount > 0 && 
      state.sopReferences.length > 1) {
    return 'sourceValidation';
  }

  // For low confidence, consider follow-up generation
  if (evaluation.responseStrategy === 'escape_hatch' && 
      evaluation.qualityMetrics.gapCount > 2) {
    return 'followUpGeneration';
  }

  // Default to response generation
  return 'responseGeneration';
}