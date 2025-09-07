import { createConfiguredWorkflow, WorkflowExecutionOptions, DEFAULT_WORKFLOW_CONFIG } from './langgraph/workflow';
import { createInitialState, WorkflowState, StateValidators } from './langgraph/state';
import { WorkflowPersistenceManager, CheckpointUtils } from './langgraph/checkpointing';
import { UnifiedQueryResult, SOPReference, CoverageAnalysis } from './unified-query-processor';
import { debugLog } from './ai-config';

/**
 * LangGraph Processor - Modern replacement for unified-query-processor.ts
 * 
 * This processor maintains backward compatibility while providing enhanced
 * capabilities through LangGraph's workflow orchestration.
 */
export class LangGraphProcessor {
  private persistenceManager: WorkflowPersistenceManager | null = null;
  private enablePersistence: boolean;

  constructor(enablePersistence: boolean = false) {
    this.enablePersistence = enablePersistence;
  }

  /**
   * Main processing function - maintains compatibility with existing interface
   * Replaces the processQuery function from unified-query-processor.ts
   */
  async processQuery(
    userQuery: string,
    conversationContext: Array<{role: 'user' | 'assistant', content: string}> = [],
    options?: WorkflowExecutionOptions
  ): Promise<UnifiedQueryResult> {
    const startTime = Date.now();
    const sessionId = options?.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const workflowId = CheckpointUtils.generateWorkflowId();

    debugLog('log_xml_processing', 'Starting LangGraph query processing', {
      query: userQuery,
      sessionId,
      workflowId,
      contextLength: conversationContext.length
    });

    try {
      // Initialize persistence manager if enabled
      if (this.enablePersistence) {
        this.persistenceManager = new WorkflowPersistenceManager(
          sessionId,
          options?.config?.enableCheckpointing ?? DEFAULT_WORKFLOW_CONFIG.enableCheckpointing,
          options?.config?.checkpointInterval ?? DEFAULT_WORKFLOW_CONFIG.checkpointInterval
        );
      }

      // Check for resumable workflow
      let initialState: WorkflowState;
      let resumeFromCheckpoint = false;

      if (this.persistenceManager) {
        const resumeData = await this.persistenceManager.resumeWorkflow(workflowId);
        if (resumeData && !CheckpointUtils.isCheckpointStale(await this.persistenceManager.getCheckpointSaver().loadCheckpoint(workflowId) as any)) {
          initialState = resumeData.state;
          resumeFromCheckpoint = true;
          debugLog('log_xml_processing', 'Resuming from checkpoint', {
            workflowId,
            nextNode: resumeData.nextNode
          });
        } else {
          initialState = createInitialState(userQuery, conversationContext, sessionId);
          this.persistenceManager.resetCounter();
        }
      } else {
        initialState = createInitialState(userQuery, conversationContext, sessionId);
      }

      // Create and configure workflow
      const workflow = createConfiguredWorkflow(options?.config ?? DEFAULT_WORKFLOW_CONFIG);

      // Set up node completion callback for persistence
      const onNodeComplete = async (nodeName: string, state: WorkflowState) => {
        if (this.persistenceManager) {
          await this.persistenceManager.onNodeComplete(workflowId, nodeName, state);
        }
        
        // Call user-provided callback if exists
        if (options?.onNodeComplete) {
          options.onNodeComplete(nodeName, state);
        }
      };

      // Execute workflow
      let finalState: WorkflowState;
      
      try {
        const result = await workflow.invoke(initialState, {
          configurable: {
            thread_id: sessionId,
            checkpoint_ns: workflowId
          }
        });
        
        finalState = result;

        // Validate final state
        if (!StateValidators.hasResponse(finalState)) {
          throw new Error('Workflow completed without generating a response');
        }

      } catch (workflowError) {
        console.error('Workflow execution error:', workflowError);
        
        // Create fallback response
        finalState = {
          ...initialState,
          response: this.generateFallbackResponse(userQuery),
          errors: [
            ...(initialState.errors || []),
            `Workflow execution failed: ${workflowError instanceof Error ? workflowError.message : 'Unknown error'}`
          ],
          shouldExit: true,
          metadata: {
            ...initialState.metadata,
            endTime: Date.now(),
            processingTime: Date.now() - startTime
          }
        };
      }

      // Convert to UnifiedQueryResult format for backward compatibility
      const result = this.convertToUnifiedQueryResult(finalState, startTime);

      debugLog('log_xml_processing', 'LangGraph processing complete', {
        workflowId,
        processingTime: result.processingTime,
        confidence: result.coverageAnalysis.overallConfidence,
        strategy: result.coverageAnalysis.responseStrategy,
        nodesExecuted: finalState.metadata.nodesExecuted.length,
        resumed: resumeFromCheckpoint
      });

      return result;

    } catch (error) {
      console.error('LangGraph processor error:', error);
      
      // Return fallback result matching UnifiedQueryResult interface
      return {
        answer: this.generateFallbackResponse(userQuery),
        sopReferences: [],
        coverageAnalysis: {
          overallConfidence: 0,
          coverageLevel: 'low',
          gaps: ['System error during processing'],
          responseStrategy: 'escape_hatch',
          queryIntent: userQuery,
          keyTopics: []
        },
        processingTime: Date.now() - startTime,
        tokensUsed: 0
      };
    }
  }

  /**
   * Convert WorkflowState to UnifiedQueryResult for backward compatibility
   */
  private convertToUnifiedQueryResult(
    state: WorkflowState, 
    startTime: number
  ): UnifiedQueryResult {
    return {
      answer: state.response,
      sopReferences: state.sopReferences,
      coverageAnalysis: state.coverageAnalysis,
      processingTime: state.metadata.processingTime || (Date.now() - startTime),
      tokensUsed: state.metadata.tokensUsed
    };
  }

  /**
   * Generate fallback response for errors
   */
  private generateFallbackResponse(query: string): string {
    return `I encountered an error processing your query: "${query}". 📝 Please try rephrasing your question or leave feedback so we can investigate and improve the system.`;
  }

  /**
   * Get workflow execution statistics
   */
  async getWorkflowStats(sessionId: string): Promise<{
    checkpointCount: number;
    lastCheckpointAge: number;
    workflowHistory: any[];
  }> {
    if (!this.persistenceManager) {
      return {
        checkpointCount: 0,
        lastCheckpointAge: -1,
        workflowHistory: []
      };
    }

    const history = await this.persistenceManager.getHistory();
    
    return {
      checkpointCount: history.length,
      lastCheckpointAge: history.length > 0 ? CheckpointUtils.getCheckpointAge(history[0]) : -1,
      workflowHistory: history.map(checkpoint => ({
        workflowId: checkpoint.workflowId,
        timestamp: checkpoint.timestamp,
        currentNode: checkpoint.currentNode,
        completedNodes: checkpoint.completedNodes.length,
        confidence: checkpoint.state.confidence
      }))
    };
  }

  /**
   * Clear workflow state for a session
   */
  async clearSession(sessionId: string): Promise<void> {
    if (this.persistenceManager) {
      await this.persistenceManager.getCheckpointSaver().clearCheckpoints();
    }
  }
}

/**
 * Factory function for creating LangGraph processor
 * Maintains compatibility with existing usage patterns
 */
export function createLangGraphProcessor(options?: {
  enablePersistence?: boolean;
}): LangGraphProcessor {
  return new LangGraphProcessor(options?.enablePersistence ?? false);
}

/**
 * Drop-in replacement function for existing processQuery calls
 * This function can replace direct imports of processQuery from unified-query-processor
 */
export async function processQueryWithLangGraph(
  userQuery: string,
  conversationContext: Array<{role: 'user' | 'assistant', content: string}> = [],
  sessionId?: string
): Promise<UnifiedQueryResult> {
  const processor = createLangGraphProcessor({ enablePersistence: true });
  
  return await processor.processQuery(userQuery, conversationContext, {
    sessionId,
    config: {
      enableCheckpointing: true,
      checkpointInterval: 2 // Checkpoint more frequently for production
    }
  });
}

/**
 * Export the processor class as default for easy importing
 */
export default LangGraphProcessor;