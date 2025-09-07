import { MemorySaver } from '@langchain/langgraph';
import { WorkflowState } from './state';
import { ChatHistory } from '@/models/ChatHistory';

/**
 * LangGraph Checkpointing and Persistence
 * Integrates with existing ChatHistory model to provide workflow state persistence
 */

/**
 * Checkpoint data structure
 */
export interface WorkflowCheckpoint {
  sessionId: string;
  workflowId: string;
  timestamp: number;
  currentNode: string;
  completedNodes: string[];
  state: WorkflowState;
  version: number;
}

/**
 * Custom checkpoint saver that integrates with our existing ChatHistory system
 */
export class ChatHistoryCheckpointSaver extends MemorySaver {
  private sessionId: string;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
  }

  /**
   * Save checkpoint to ChatHistory with workflow state
   */
  async saveCheckpoint(
    workflowId: string, 
    state: WorkflowState, 
    currentNode: string
  ): Promise<void> {
    try {
      const checkpoint: WorkflowCheckpoint = {
        sessionId: this.sessionId,
        workflowId,
        timestamp: Date.now(),
        currentNode,
        completedNodes: state.completedNodes,
        state: {
          ...state,
          // Remove sensitive or large data from checkpoint
          conversationContext: state.conversationContext.slice(-5), // Keep last 5 messages
          sopReferences: state.sopReferences.map(ref => ({
            ...ref,
            // Don't store full SOP content in checkpoint
            content: undefined
          })) as any
        },
        version: 1
      };

      // Store checkpoint in ChatHistory as a system message
      await ChatHistory.addMessage(this.sessionId, {
        role: 'system',
        content: JSON.stringify(checkpoint),
        messageType: 'checkpoint'
      });

      console.log(`Checkpoint saved: ${workflowId} at node ${currentNode}`);
      
    } catch (error) {
      console.error('Error saving checkpoint:', error);
      // Don't throw - checkpointing should be non-blocking
    }
  }

  /**
   * Load the most recent checkpoint for a session
   */
  async loadCheckpoint(workflowId?: string): Promise<WorkflowCheckpoint | null> {
    try {
      const chatHistory = await ChatHistory.findBySessionId(this.sessionId);
      
      if (!chatHistory || !chatHistory.data.messages) {
        return null;
      }

      // Find the most recent checkpoint message
      const checkpointMessages = chatHistory.data.messages
        .filter(msg => msg.role === 'system' && msg.messageType === 'checkpoint')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (checkpointMessages.length === 0) {
        return null;
      }

      const latestCheckpointMsg = checkpointMessages[0];
      const checkpoint: WorkflowCheckpoint = JSON.parse(latestCheckpointMsg.content);

      // If workflowId is specified, find that specific checkpoint
      if (workflowId && checkpoint.workflowId !== workflowId) {
        const specificCheckpoint = checkpointMessages
          .map(msg => JSON.parse(msg.content) as WorkflowCheckpoint)
          .find(cp => cp.workflowId === workflowId);
        
        return specificCheckpoint || null;
      }

      return checkpoint;
      
    } catch (error) {
      console.error('Error loading checkpoint:', error);
      return null;
    }
  }

  /**
   * Resume workflow from checkpoint
   */
  async resumeFromCheckpoint(workflowId?: string): Promise<{
    state: WorkflowState;
    nextNode: string;
  } | null> {
    const checkpoint = await this.loadCheckpoint(workflowId);
    
    if (!checkpoint) {
      return null;
    }

    console.log(`Resuming workflow ${checkpoint.workflowId} from node ${checkpoint.currentNode}`);
    
    return {
      state: checkpoint.state,
      nextNode: checkpoint.currentNode
    };
  }

  /**
   * Clear all checkpoints for a session
   */
  async clearCheckpoints(): Promise<void> {
    try {
      // This would require updating ChatHistory to remove checkpoint messages
      // For now, we'll leave them as they provide useful audit trail
      console.log(`Checkpoints preserved for session ${this.sessionId}`);
    } catch (error) {
      console.error('Error clearing checkpoints:', error);
    }
  }

  /**
   * Get checkpoint history for debugging
   */
  async getCheckpointHistory(): Promise<WorkflowCheckpoint[]> {
    try {
      const chatHistory = await ChatHistory.findBySessionId(this.sessionId);
      
      if (!chatHistory || !chatHistory.data.messages) {
        return [];
      }

      return chatHistory.data.messages
        .filter(msg => msg.role === 'system' && msg.messageType === 'checkpoint')
        .map(msg => JSON.parse(msg.content) as WorkflowCheckpoint)
        .sort((a, b) => b.timestamp - a.timestamp);
        
    } catch (error) {
      console.error('Error getting checkpoint history:', error);
      return [];
    }
  }
}

/**
 * Workflow persistence manager
 */
export class WorkflowPersistenceManager {
  private checkpointSaver: ChatHistoryCheckpointSaver;
  private enableCheckpointing: boolean;
  private checkpointInterval: number;
  private nodeCount: number = 0;

  constructor(
    sessionId: string, 
    enableCheckpointing: boolean = true,
    checkpointInterval: number = 3
  ) {
    this.checkpointSaver = new ChatHistoryCheckpointSaver(sessionId);
    this.enableCheckpointing = enableCheckpointing;
    this.checkpointInterval = checkpointInterval;
  }

  /**
   * Called after each node execution to potentially save checkpoint
   */
  async onNodeComplete(
    workflowId: string,
    nodeName: string, 
    state: WorkflowState
  ): Promise<void> {
    this.nodeCount++;

    // Save checkpoint at intervals or for important nodes
    const shouldCheckpoint = 
      this.enableCheckpointing && (
        this.nodeCount % this.checkpointInterval === 0 ||
        this.isImportantNode(nodeName) ||
        state.shouldExit
      );

    if (shouldCheckpoint) {
      await this.checkpointSaver.saveCheckpoint(workflowId, state, nodeName);
    }
  }

  /**
   * Resume workflow from checkpoint
   */
  async resumeWorkflow(workflowId?: string): Promise<{
    state: WorkflowState;
    nextNode: string;
  } | null> {
    if (!this.enableCheckpointing) {
      return null;
    }

    return await this.checkpointSaver.resumeFromCheckpoint(workflowId);
  }

  /**
   * Get checkpoint saver for LangGraph integration
   */
  getCheckpointSaver(): ChatHistoryCheckpointSaver {
    return this.checkpointSaver;
  }

  /**
   * Determine if a node is important enough to always checkpoint
   */
  private isImportantNode(nodeName: string): boolean {
    const importantNodes = [
      'sopAssessment',
      'coverageEvaluation', 
      'responseSynthesis'
    ];
    
    return importantNodes.includes(nodeName);
  }

  /**
   * Reset node counter (call at start of new workflow)
   */
  resetCounter(): void {
    this.nodeCount = 0;
  }

  /**
   * Get checkpoint history for debugging
   */
  async getHistory(): Promise<WorkflowCheckpoint[]> {
    return await this.checkpointSaver.getCheckpointHistory();
  }
}

/**
 * Utility functions for checkpoint management
 */
export const CheckpointUtils = {
  /**
   * Generate unique workflow ID
   */
  generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Validate checkpoint integrity
   */
  validateCheckpoint(checkpoint: WorkflowCheckpoint): boolean {
    return !!(
      checkpoint.sessionId &&
      checkpoint.workflowId &&
      checkpoint.timestamp &&
      checkpoint.currentNode &&
      checkpoint.state
    );
  },

  /**
   * Calculate checkpoint age in minutes
   */
  getCheckpointAge(checkpoint: WorkflowCheckpoint): number {
    return Math.floor((Date.now() - checkpoint.timestamp) / (1000 * 60));
  },

  /**
   * Check if checkpoint is stale (older than threshold)
   */
  isCheckpointStale(checkpoint: WorkflowCheckpoint, maxAgeMinutes: number = 60): boolean {
    return this.getCheckpointAge(checkpoint) > maxAgeMinutes;
  }
};

/**
 * Extended ChatHistory message type for checkpoints
 */
declare module '@/models/ChatHistory' {
  interface ChatMessage {
    messageType?: 'user' | 'assistant' | 'system' | 'checkpoint';
  }
}