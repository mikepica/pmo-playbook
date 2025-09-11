/**
 * Parallel Processing Utilities for LangGraph Workflow
 * 
 * Provides utilities for running operations concurrently to improve performance
 */

import { getAllActiveSOPs, getSOPCacheStats, SOPCacheEntry } from '../sop-cache';
import { WorkflowState } from './state';

export interface ParallelOperationResult<T> {
  result: T;
  duration: number;
  success: boolean;
  error?: Error;
}

export interface SOPLoadResult {
  sopEntries: SOPCacheEntry[];
  cacheStats: any;
  legacySOPCache: Map<string, any>;
}

/**
 * Load SOPs with performance tracking
 */
export async function loadSOPsWithTiming(): Promise<ParallelOperationResult<SOPLoadResult>> {
  const startTime = Date.now();
  
  try {
    console.log('🔄 Starting parallel SOP loading...');
    
    // Get cache stats before loading
    const cacheStats = getSOPCacheStats();
    
    // Load SOPs from cache
    const sopEntries = await getAllActiveSOPs();
    
    // Create legacy SOP cache for downstream compatibility
    const legacySOPCache = new Map();
    for (const entry of sopEntries) {
      const legacyRecord = {
        sopId: entry.sopId,
        data: {
          title: entry.title,
          markdownContent: entry.fullContent
        }
      };
      legacySOPCache.set(entry.sopId, legacyRecord);
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Parallel SOP loading completed:`, {
      sopCount: sopEntries.length,
      duration: `${duration}ms`,
      cacheHitRate: cacheStats.cacheHits / (cacheStats.cacheHits + cacheStats.cacheMisses) * 100
    });
    
    return {
      result: {
        sopEntries,
        cacheStats,
        legacySOPCache
      },
      duration,
      success: true
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Parallel SOP loading failed:', error);
    
    return {
      result: {
        sopEntries: [],
        cacheStats: getSOPCacheStats(),
        legacySOPCache: new Map()
      },
      duration,
      success: false,
      error: error instanceof Error ? error : new Error('Unknown SOP loading error')
    };
  }
}

/**
 * Run multiple async operations in parallel with timeout and error handling
 */
export async function runInParallel<T extends Record<string, Promise<any>>>(
  operations: T,
  options: {
    timeout?: number;
    failFast?: boolean;
    logResults?: boolean;
  } = {}
): Promise<{ [K in keyof T]: ParallelOperationResult<Awaited<T[K]>> }> {
  
  const {
    timeout = 30000, // 30 seconds default
    failFast = false,
    logResults = true
  } = options;
  
  console.log(`🚀 Running ${Object.keys(operations).length} operations in parallel...`);
  
  const startTime = Date.now();
  const results = {} as { [K in keyof T]: ParallelOperationResult<Awaited<T[K]>> };
  
  // Wrap each operation with timing and error handling
  const wrappedOperations = Object.entries(operations).map(async ([key, promise]) => {
    const opStartTime = Date.now();
    
    try {
      // Add timeout to each operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operation '${key}' timed out after ${timeout}ms`)), timeout);
      });
      
      const result = await Promise.race([promise, timeoutPromise]);
      const duration = Date.now() - opStartTime;
      
      results[key as keyof T] = {
        result,
        duration,
        success: true
      };
      
      if (logResults) {
        console.log(`✅ ${key} completed in ${duration}ms`);
      }
      
    } catch (error) {
      const duration = Date.now() - opStartTime;
      
      results[key as keyof T] = {
        result: null as any,
        duration,
        success: false,
        error: error instanceof Error ? error : new Error(`Unknown error in ${key}`)
      };
      
      if (logResults) {
        console.error(`❌ ${key} failed after ${duration}ms:`, error);
      }
      
      if (failFast) {
        throw error;
      }
    }
  });
  
  // Wait for all operations to complete
  await Promise.all(wrappedOperations);
  
  const totalDuration = Date.now() - startTime;
  const successCount = Object.values(results).filter(r => r.success).length;
  const failureCount = Object.values(results).filter(r => !r.success).length;
  
  if (logResults) {
    console.log(`🏁 Parallel execution completed in ${totalDuration}ms:`, {
      successful: successCount,
      failed: failureCount,
      total: Object.keys(operations).length
    });
  }
  
  return results;
}

/**
 * Enhanced query analysis that can run in parallel with SOP loading
 */
export interface QueryAnalysisInput {
  query: string;
  conversationContext: Array<{role: 'user' | 'assistant', content: string}>;
  sessionId: string;
}

export interface QueryAnalysisResult {
  intent: string;
  keyTopics: string[];
  specificityLevel: string;
  initialConfidence: number;
}

/**
 * Check if parallel processing is enabled for the workflow
 */
export function isParallelProcessingEnabled(): boolean {
  return process.env.ENABLE_PARALLEL_PROCESSING !== 'false'; // Enabled by default
}

/**
 * Get parallel processing configuration
 */
export function getParallelConfig() {
  return {
    enabled: isParallelProcessingEnabled(),
    timeout: parseInt(process.env.PARALLEL_TIMEOUT_MS || '30000'),
    sopPreloading: process.env.ENABLE_SOP_PRELOADING !== 'false',
    maxConcurrency: parseInt(process.env.MAX_PARALLEL_OPERATIONS || '3')
  };
}

/**
 * Add parallel operation metadata to workflow state
 */
export function addParallelMetadata(
  state: WorkflowState, 
  operationName: string, 
  result: ParallelOperationResult<any>
): Partial<WorkflowState> {
  
  const parallelInfo = {
    operation: operationName,
    duration: result.duration,
    success: result.success,
    timestamp: Date.now()
  };
  
  // Add to metadata
  const updatedMetadata = {
    ...state.metadata,
    parallelOperations: [
      ...(state.metadata.parallelOperations || []),
      parallelInfo
    ]
  };
  
  return {
    metadata: updatedMetadata
  };
}