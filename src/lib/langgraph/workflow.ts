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
 * Conditional routing function - determines next node based on state
 */
function routeAfterCoverageEvaluation(state: WorkflowState): string {
  // Handle error cases first
  if (StateValidators.hasErrors(state) && StateValidators.shouldRetry(state)) {
    return NODE_NAMES.QUERY_ANALYSIS; // Retry from beginning
  }

  if (state.shouldExit) {
    return END;
  }

  // Route based on coverage evaluation results
  const strategy = state.coverageAnalysis.responseStrategy;
  const sopCount = state.sopReferences.length;
  const confidence = state.confidence;
  const gapCount = state.coverageAnalysis.gaps.length;

  // High confidence with multiple SOPs -> fact checking
  if (strategy === 'full_answer' && sopCount > 1 && confidence > 0.8) {
    return NODE_NAMES.FACT_CHECKING;
  }

  // Medium confidence with gaps and multiple SOPs -> source validation
  if (strategy === 'partial_answer' && gapCount > 0 && sopCount > 1) {
    return NODE_NAMES.SOURCE_VALIDATION;
  }

  // Low confidence with multiple gaps -> follow-up generation
  if (strategy === 'escape_hatch' && gapCount > 2) {
    return NODE_NAMES.FOLLOW_UP_GENERATION;
  }

  // Default to response synthesis
  return NODE_NAMES.RESPONSE_SYNTHESIS;
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
 * Create the main workflow graph
 */
export function createWorkflowGraph() {
  // Create the state graph
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      query: null,
      conversationContext: null,
      sessionId: null,
      sopReferences: null,
      coverageAnalysis: null,
      confidence: null,
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

  // Define the workflow edges (linear path with conditional routing)
  workflow.setEntryPoint(NODE_NAMES.QUERY_ANALYSIS);
  
  // Linear flow through core analysis
  workflow.addEdge(NODE_NAMES.QUERY_ANALYSIS, NODE_NAMES.SOP_ASSESSMENT);
  workflow.addEdge(NODE_NAMES.SOP_ASSESSMENT, NODE_NAMES.COVERAGE_EVALUATION);
  
  // Conditional routing after coverage evaluation
  workflow.addConditionalEdges(
    NODE_NAMES.COVERAGE_EVALUATION,
    routeAfterCoverageEvaluation,
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
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxIterations: 10,
  nodeTimeout: 30000, // 30 seconds
  enableCheckpointing: false,
  checkpointInterval: 3, // Checkpoint every 3 nodes
  retryLimit: 3
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
  const workflow = createWorkflowGraph();
  
  // Apply configuration
  if (config.maxIterations) {
    // Note: LangGraph handles max iterations internally
  }
  
  return workflow;
}