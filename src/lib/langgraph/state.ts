/**
 * Shared types for the LangGraph workflow system
 */
import { HumanSOPRecord } from '@/models/HumanSOP';
export interface SOPReference {
  sopId: string;
  title: string;
  sections: string[];
  confidence: number;
  keyPoints: string[];
  applicability: string;
}

export interface CoverageAnalysis {
  overallConfidence: number;
  coverageLevel: 'high' | 'medium' | 'low';
  gaps: string[];
  responseStrategy: 'full_answer' | 'partial_answer' | 'escape_hatch';
  queryIntent: string;
  keyTopics: string[];
}

export interface UnifiedQueryResult {
  answer: string;
  sopReferences: SOPReference[];
  coverageAnalysis: CoverageAnalysis;
  processingTime: number;
  tokensUsed: number;
}

/**
 * State schema for LangGraph workflow
 * This maintains compatibility with existing types while adding new capabilities
 */
export interface WorkflowState {
  // Input data
  query: string;
  conversationContext: Array<{role: 'user' | 'assistant', content: string}>;
  sessionId?: string;
  
  // Processing data
  sopReferences: SOPReference[];
  coverageAnalysis: CoverageAnalysis;
  confidence: number;
  
  // Performance optimization: Cache SOPs to avoid redundant database fetches
  cachedSOPs?: Map<string, HumanSOPRecord>;
  
  // Parallel processing: Preloaded SOP data
  preloadedSOPs?: any; // SOPLoadResult from parallel processing
  sopPreloadSuccess?: boolean;
  
  // Output data
  response: string;
  
  // Metadata and tracking
  metadata: ProcessingMetadata;
  
  // Enhanced workflow data
  factCheckResults?: FactCheckResult[];
  sourceValidationResults?: SourceValidationResult[];
  followUpSuggestions?: string[];
  
  // Error handling
  errors: string[];
  retryCount: number;
  
  // Workflow control
  currentNode: string;
  completedNodes: string[];
  shouldRetry: boolean;
  shouldExit: boolean;
}

export interface ParallelOperationInfo {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: number;
  error?: string;
}

export interface ProcessingMetadata {
  startTime: number;
  endTime?: number;
  processingTime?: number;
  tokensUsed: number;
  nodesExecuted: string[];
  llmCalls: LLMCallMetadata[];
  confidenceHistory: ConfidenceEntry[];
  parallelOperations?: ParallelOperationInfo[];
}

export interface LLMCallMetadata {
  node: string;
  model: string;
  timestamp: number;
  tokensIn: number;
  tokensOut: number;
  latency: number;
  success: boolean;
  error?: string;
}

export interface ConfidenceEntry {
  node: string;
  timestamp: number;
  confidence: number;
  reason: string;
}

export interface FactCheckResult {
  sopId: string;
  claim: string;
  verified: boolean;
  confidence: number;
  source: string;
  notes?: string;
}

export interface SourceValidationResult {
  primarySopId: string;
  crossReferenceSopIds: string[];
  consistencyScore: number;
  conflicts: string[];
  recommendations: string[];
}

/**
 * Initial state factory function
 */
export function createInitialState(
  query: string, 
  conversationContext: Array<{role: 'user' | 'assistant', content: string}> = [],
  sessionId?: string
): WorkflowState {
  return {
    query,
    conversationContext,
    sessionId,
    sopReferences: [],
    coverageAnalysis: {
      overallConfidence: 0,
      coverageLevel: 'low',
      gaps: [],
      responseStrategy: 'escape_hatch',
      queryIntent: '',
      keyTopics: []
    },
    confidence: 0,
    response: '',
    metadata: {
      startTime: Date.now(),
      tokensUsed: 0,
      nodesExecuted: [],
      llmCalls: [],
      confidenceHistory: []
    },
    errors: [],
    retryCount: 0,
    currentNode: 'queryAnalysis',
    completedNodes: [],
    shouldRetry: false,
    shouldExit: false
  };
}

/**
 * State update helper functions
 */
export const StateHelpers = {
  /**
   * Update metadata with node completion
   */
  markNodeComplete: (state: WorkflowState, nodeName: string): WorkflowState => ({
    ...state,
    completedNodes: [...state.completedNodes, nodeName],
    currentNode: '',
    metadata: {
      ...state.metadata,
      nodesExecuted: [...state.metadata.nodesExecuted, nodeName]
    }
  }),

  /**
   * Add confidence entry
   */
  addConfidenceEntry: (
    state: WorkflowState, 
    nodeName: string, 
    confidence: number, 
    reason: string
  ): WorkflowState => ({
    ...state,
    confidence: Math.max(state.confidence, confidence),
    metadata: {
      ...state.metadata,
      confidenceHistory: [
        ...state.metadata.confidenceHistory,
        {
          node: nodeName,
          timestamp: Date.now(),
          confidence,
          reason
        }
      ]
    }
  }),

  /**
   * Add LLM call metadata
   */
  addLLMCall: (
    state: WorkflowState,
    callMetadata: Omit<LLMCallMetadata, 'timestamp'>
  ): WorkflowState => ({
    ...state,
    metadata: {
      ...state.metadata,
      tokensUsed: state.metadata.tokensUsed + callMetadata.tokensIn + callMetadata.tokensOut,
      llmCalls: [
        ...state.metadata.llmCalls,
        {
          ...callMetadata,
          timestamp: Date.now()
        }
      ]
    }
  }),

  /**
   * Add error
   */
  addError: (state: WorkflowState, error: string): WorkflowState => ({
    ...state,
    errors: [...state.errors, error]
  }),

  /**
   * Mark workflow complete
   */
  markComplete: (state: WorkflowState): WorkflowState => ({
    ...state,
    shouldExit: true,
    metadata: {
      ...state.metadata,
      endTime: Date.now(),
      processingTime: Date.now() - state.metadata.startTime
    }
  })
};

/**
 * Type guards for state validation
 */
export const StateValidators = {
  hasValidQuery: (state: WorkflowState): boolean => 
    Boolean(state.query && state.query.trim().length > 0),
    
  hasSOPReferences: (state: WorkflowState): boolean =>
    state.sopReferences.length > 0,
    
  hasCoverageAnalysis: (state: WorkflowState): boolean =>
    Boolean(state.coverageAnalysis && state.coverageAnalysis.overallConfidence > 0),
    
  hasResponse: (state: WorkflowState): boolean =>
    Boolean(state.response && state.response.trim().length > 0),
    
  hasErrors: (state: WorkflowState): boolean =>
    state.errors.length > 0,
    
  shouldRetry: (state: WorkflowState): boolean =>
    state.shouldRetry && state.retryCount < 3,
    
  canProceed: (state: WorkflowState, requiredNodes: string[]): boolean =>
    requiredNodes.every(node => state.completedNodes.includes(node))
};