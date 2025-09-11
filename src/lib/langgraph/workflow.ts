import { StateGraph, END } from '@langchain/langgraph';
import { WorkflowState, StateValidators } from './state';

// Import all nodes
import { queryAnalysisNode } from './nodes/queryAnalysisNode';
import { sopAssessmentNode } from './nodes/sopAssessmentNode';
import { coverageEvaluationNode } from './nodes/coverageEvaluationNode';
import { factCheckingNode } from './nodes/factCheckingNode';
import { sourceValidationNode } from './nodes/sourceValidationNode';
import { followUpGenerationNode } from './nodes/followUpGenerationNode';
import { responseSynthesisNode } from './nodes/responseSynthesisNode';

/**
 * Main LangGraph workflow for PMO Playbook AI processing
 * Replaces the linear processing in unified-query-processor.ts with
 * conditional routing and enhanced capabilities
 */

// Define node names as constants for type safety
export const NODE_NAMES = {
  QUERY_ANALYSIS: 'queryAnalysis',
  SOP_ASSESSMENT: 'sopAssessment', 
  COVERAGE_EVALUATION: 'coverageEvaluation',
  FACT_CHECKING: 'factChecking',
  SOURCE_VALIDATION: 'sourceValidation',
  FOLLOW_UP_GENERATION: 'followUpGeneration',
  RESPONSE_SYNTHESIS: 'responseSynthesis'
} as const;

/**
 * Optimized conditional routing function - skips unnecessary nodes for performance
 */
function createOptimizedCoverageRouter(config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG) {
  return function routeAfterCoverageEvaluation(state: WorkflowState): string {
  // Handle error cases first
  if (StateValidators.hasErrors(state) && StateValidators.shouldRetry(state)) {
    return NODE_NAMES.QUERY_ANALYSIS; // Retry from beginning
  }

  if (state.shouldExit) {
    return END;
  }

  // Get routing parameters
  const strategy = state.coverageAnalysis.responseStrategy;
  const sopCount = state.sopReferences.length;
  const confidence = state.coverageAnalysis.overallConfidence || state.confidence || 0;
  const gapCount = state.coverageAnalysis.gaps?.length || 0;

  console.log('Workflow routing decision:', {
    strategy,
    sopCount,
    confidence,
    gapCount,
    query: state.query.substring(0, 50) + '...'
  });

    // Check if early exit optimizations are enabled
    if (!config.enableEarlyExit) {
      // Original routing logic for compatibility
      if (strategy === 'full_answer' && sopCount > 1 && confidence > 0.8) {
        return NODE_NAMES.FACT_CHECKING;
      }
      if (strategy === 'partial_answer' && gapCount > 0 && sopCount > 1) {
        return NODE_NAMES.SOURCE_VALIDATION;
      }
      if (strategy === 'escape_hatch' && gapCount > 2) {
        return NODE_NAMES.FOLLOW_UP_GENERATION;
      }
      return NODE_NAMES.RESPONSE_SYNTHESIS;
    }

    // OPTIMIZATION: Early exit for high-confidence queries
    const highThreshold = config.highConfidenceThreshold || 0.8;
    if (confidence > highThreshold && gapCount === 0 && strategy === 'full_answer') {
      console.log(`🚀 High confidence route (>${highThreshold}): Skipping extra nodes, going directly to response synthesis`);
      return NODE_NAMES.RESPONSE_SYNTHESIS;
    }

    // OPTIMIZATION: Early exit for escape hatch cases  
    const lowThreshold = config.lowConfidenceThreshold || 0.3;
    if (strategy === 'escape_hatch' || confidence < lowThreshold) {
      console.log(`🚨 Low confidence route (<${lowThreshold}): Going directly to response synthesis (escape hatch)`);
      return NODE_NAMES.RESPONSE_SYNTHESIS;
    }

    // OPTIMIZATION: Skip fact-checking unless enabled and needed
    if (config.enableFactChecking && strategy === 'full_answer' && sopCount > 2 && confidence >= 0.6 && confidence <= highThreshold) {
      console.log('🔍 Medium confidence with multiple SOPs: Using fact checking');
      return NODE_NAMES.FACT_CHECKING;
    }

    // OPTIMIZATION: Skip source validation unless enabled and there are significant gaps
    if (config.enableSourceValidation && strategy === 'partial_answer' && gapCount > 1 && sopCount > 1 && confidence >= 0.5) {
      console.log('📋 Partial answer with gaps: Using source validation');
      return NODE_NAMES.SOURCE_VALIDATION;
    }

    // OPTIMIZATION: Skip follow-up generation unless specifically enabled
    if (config.enableFollowUpGeneration && strategy === 'escape_hatch' && gapCount > 3 && sopCount === 0) {
      console.log('❓ No SOPs found with many gaps: Generating follow-up questions');
      return NODE_NAMES.FOLLOW_UP_GENERATION;
    }

    // Default: Skip to response synthesis (most common path)
    console.log('✨ Optimized route: Going to response synthesis');
    return NODE_NAMES.RESPONSE_SYNTHESIS;
  };
}

/**
 * Early exit routing after SOP assessment for extremely high confidence cases
 */
function createOptimizedSOPRouter(config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG) {
  return function routeAfterSOPAssessment(state: WorkflowState): string {
  // Handle error cases
  if (StateValidators.hasErrors(state) && StateValidators.shouldRetry(state)) {
    return NODE_NAMES.QUERY_ANALYSIS;
  }

  if (state.shouldExit) {
    return END;
  }

  // Get confidence and strategy from SOP assessment
  const confidence = state.coverageAnalysis.overallConfidence || 0;
  const strategy = state.coverageAnalysis.responseStrategy;
  const sopCount = state.sopReferences.length;
  const gapCount = state.coverageAnalysis.gaps?.length || 0;

  console.log('Early exit evaluation after SOP assessment:', {
    confidence,
    strategy,
    sopCount,
    gapCount
  });

    // SUPER OPTIMIZATION: Skip coverage evaluation for extremely confident cases
    const superHighThreshold = config.superHighConfidenceThreshold || 0.9;
    if (config.enableEarlyExit && confidence > superHighThreshold && strategy === 'full_answer' && gapCount === 0 && sopCount >= 1) {
      console.log(`⚡ SUPER HIGH CONFIDENCE (>${superHighThreshold}): Skipping coverage evaluation, going directly to response`);
      return NODE_NAMES.RESPONSE_SYNTHESIS;
    }

    // Normal flow: proceed to coverage evaluation
    return NODE_NAMES.COVERAGE_EVALUATION;
  };
}

/**
 * Simple routing for enhanced nodes - all lead to response synthesis
 */
function routeToResponseSynthesis(state: WorkflowState): string {
  if (state.shouldExit) {
    return END;
  }
  return NODE_NAMES.RESPONSE_SYNTHESIS;
}

/**
 * Final routing - end the workflow
 */
function routeFromResponseSynthesis(): string {
  return END;
}

/**
 * Error handling wrapper for nodes
 */
function wrapNodeWithErrorHandling<T extends WorkflowState>(
  nodeFunction: (state: T) => Promise<Partial<T>>,
  nodeName: string
) {
  return async (state: T): Promise<Partial<T>> => {
    try {
      const result = await nodeFunction(state);
      
      // Reset retry count on successful execution
      if (result && !result.errors?.length) {
        return { ...result, retryCount: 0 };
      }
      
      return result;
    } catch (error) {
      console.error(`Error in ${nodeName}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : `Unknown error in ${nodeName}`;
      
      return {
        errors: [...(state.errors || []), errorMessage],
        shouldRetry: state.retryCount < 3,
        retryCount: state.retryCount + 1,
        currentNode: nodeName
      };
    }
  };
}

/**
 * Create the main workflow graph with configuration
 */
export function createWorkflowGraph(config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG) {
  // Create the state graph
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      query: null,
      conversationContext: null,
      sessionId: null,
      sopReferences: null,
      coverageAnalysis: null,
      confidence: null,
      cachedSOPs: null,
      response: null,
      metadata: null,
      factCheckResults: null,
      sourceValidationResults: null,
      followUpSuggestions: null,
      errors: null,
      retryCount: null,
      currentNode: null,
      completedNodes: null,
      shouldRetry: null,
      shouldExit: null
    }
  });

  // Add all nodes with error handling
  workflow.addNode(
    NODE_NAMES.QUERY_ANALYSIS, 
    wrapNodeWithErrorHandling(queryAnalysisNode, NODE_NAMES.QUERY_ANALYSIS)
  );
  
  workflow.addNode(
    NODE_NAMES.SOP_ASSESSMENT,
    wrapNodeWithErrorHandling(sopAssessmentNode, NODE_NAMES.SOP_ASSESSMENT)
  );
  
  workflow.addNode(
    NODE_NAMES.COVERAGE_EVALUATION,
    wrapNodeWithErrorHandling(coverageEvaluationNode, NODE_NAMES.COVERAGE_EVALUATION)
  );
  
  workflow.addNode(
    NODE_NAMES.FACT_CHECKING,
    wrapNodeWithErrorHandling(factCheckingNode, NODE_NAMES.FACT_CHECKING)
  );
  
  workflow.addNode(
    NODE_NAMES.SOURCE_VALIDATION,
    wrapNodeWithErrorHandling(sourceValidationNode, NODE_NAMES.SOURCE_VALIDATION)
  );
  
  workflow.addNode(
    NODE_NAMES.FOLLOW_UP_GENERATION,
    wrapNodeWithErrorHandling(followUpGenerationNode, NODE_NAMES.FOLLOW_UP_GENERATION)
  );
  
  workflow.addNode(
    NODE_NAMES.RESPONSE_SYNTHESIS,
    wrapNodeWithErrorHandling(responseSynthesisNode, NODE_NAMES.RESPONSE_SYNTHESIS)
  );

  // Define the workflow edges (optimized routing with early exits)
  workflow.setEntryPoint(NODE_NAMES.QUERY_ANALYSIS);
  
  // Flow from query analysis to SOP assessment
  workflow.addEdge(NODE_NAMES.QUERY_ANALYSIS, NODE_NAMES.SOP_ASSESSMENT);
  
  // Create configured routers
  const sopRouter = createOptimizedSOPRouter(config);
  const coverageRouter = createOptimizedCoverageRouter(config);

  // OPTIMIZATION: Conditional routing after SOP assessment (can skip coverage evaluation)
  workflow.addConditionalEdges(
    NODE_NAMES.SOP_ASSESSMENT,
    sopRouter,
    {
      [NODE_NAMES.COVERAGE_EVALUATION]: NODE_NAMES.COVERAGE_EVALUATION,
      [NODE_NAMES.RESPONSE_SYNTHESIS]: NODE_NAMES.RESPONSE_SYNTHESIS, // Early exit option
      [NODE_NAMES.QUERY_ANALYSIS]: NODE_NAMES.QUERY_ANALYSIS, // For retries
      [END]: END
    }
  );
  
  // Conditional routing after coverage evaluation
  workflow.addConditionalEdges(
    NODE_NAMES.COVERAGE_EVALUATION,
    coverageRouter,
    {
      [NODE_NAMES.FACT_CHECKING]: NODE_NAMES.FACT_CHECKING,
      [NODE_NAMES.SOURCE_VALIDATION]: NODE_NAMES.SOURCE_VALIDATION,
      [NODE_NAMES.FOLLOW_UP_GENERATION]: NODE_NAMES.FOLLOW_UP_GENERATION,
      [NODE_NAMES.RESPONSE_SYNTHESIS]: NODE_NAMES.RESPONSE_SYNTHESIS,
      [NODE_NAMES.QUERY_ANALYSIS]: NODE_NAMES.QUERY_ANALYSIS, // For retries
      [END]: END
    }
  );
  
  // Enhanced nodes all route to response synthesis
  workflow.addConditionalEdges(
    NODE_NAMES.FACT_CHECKING,
    routeToResponseSynthesis,
    {
      [NODE_NAMES.RESPONSE_SYNTHESIS]: NODE_NAMES.RESPONSE_SYNTHESIS,
      [END]: END
    }
  );
  
  workflow.addConditionalEdges(
    NODE_NAMES.SOURCE_VALIDATION,
    routeToResponseSynthesis,
    {
      [NODE_NAMES.RESPONSE_SYNTHESIS]: NODE_NAMES.RESPONSE_SYNTHESIS,
      [END]: END
    }
  );
  
  workflow.addConditionalEdges(
    NODE_NAMES.FOLLOW_UP_GENERATION,
    routeToResponseSynthesis,
    {
      [NODE_NAMES.RESPONSE_SYNTHESIS]: NODE_NAMES.RESPONSE_SYNTHESIS,
      [END]: END
    }
  );
  
  // Response synthesis always ends
  workflow.addConditionalEdges(
    NODE_NAMES.RESPONSE_SYNTHESIS,
    routeFromResponseSynthesis,
    {
      [END]: END
    }
  );

  return workflow.compile();
}

/**
 * Workflow configuration options
 */
export interface WorkflowConfig {
  maxIterations?: number;
  nodeTimeout?: number;
  enableCheckpointing?: boolean;
  checkpointInterval?: number;
  retryLimit?: number;
  
  // Performance optimization settings
  enableEarlyExit?: boolean;          // Enable early exit optimizations
  highConfidenceThreshold?: number;   // Confidence threshold for early exits (default: 0.8)
  superHighConfidenceThreshold?: number; // Threshold for skipping coverage evaluation (default: 0.9)
  lowConfidenceThreshold?: number;    // Threshold for escape hatch route (default: 0.3)
  
  // Node skipping controls
  enableFactChecking?: boolean;       // Enable fact checking node (default: true but selective)
  enableSourceValidation?: boolean;   // Enable source validation node (default: true but selective)  
  enableFollowUpGeneration?: boolean; // Enable follow-up generation node (default: false for performance)
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxIterations: 10,
  nodeTimeout: 30000, // 30 seconds
  enableCheckpointing: false,
  checkpointInterval: 3, // Checkpoint every 3 nodes
  retryLimit: 3,
  
  // Performance optimizations enabled by default
  enableEarlyExit: true,
  highConfidenceThreshold: 0.8,
  superHighConfidenceThreshold: 0.9,
  lowConfidenceThreshold: 0.3,
  
  // Selective node enabling (optimized for performance)
  enableFactChecking: true,        // Enabled but selective
  enableSourceValidation: true,    // Enabled but selective
  enableFollowUpGeneration: false  // Disabled by default for performance
};

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  config?: WorkflowConfig;
  sessionId?: string;
  enableStreaming?: boolean;
  onNodeComplete?: (nodeName: string, state: WorkflowState) => void;
  onError?: (error: Error, nodeName: string, state: WorkflowState) => void;
}

/**
 * Create workflow with configuration
 */
export function createConfiguredWorkflow(config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG) {
  const workflow = createWorkflowGraph(config);
  
  // Apply configuration
  if (config.maxIterations) {
    // Note: LangGraph handles max iterations internally
  }
  
  return workflow;
}