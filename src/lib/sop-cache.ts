/**
 * In-Memory SOP Cache Manager
 * 
 * Provides lazy-loading, in-memory caching for SOPs to eliminate database round-trips
 * on every query. Includes cache warming, invalidation, and memory management.
 */

import { HumanSOP, HumanSOPRecord } from '@/models/HumanSOP';

export interface SOPCacheEntry {
  sopId: string;
  title: string;
  fullContent: string;
  summary: string;
  lastModified: Date;
  isActive: boolean;
}

export interface SOPCacheStats {
  totalSOPs: number;
  cacheHits: number;
  cacheMisses: number;
  lastRefresh: Date;
  memoryUsageMB: number;
}

class SOPCacheManager {
  private cache: Map<string, SOPCacheEntry> = new Map();
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private stats: SOPCacheStats = {
    totalSOPs: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastRefresh: new Date(),
    memoryUsageMB: 0
  };

  // Configuration - Much more conservative defaults
  private readonly TTL_MINUTES = parseInt(process.env.SOP_CACHE_TTL_MINUTES || '60'); // 1 hour default (was 5 min)
  private readonly AUTO_REFRESH = process.env.SOP_CACHE_AUTO_REFRESH === 'true'; // false by default (was true)
  private readonly ENABLE_CACHE = process.env.ENABLE_SOP_CACHE !== 'false'; // true by default

  constructor() {
    console.log('SOP Cache initialized with configuration:', {
      ttlMinutes: this.TTL_MINUTES,
      autoRefresh: this.AUTO_REFRESH,
      enabled: this.ENABLE_CACHE
    });

    // Set up periodic refresh if enabled
    if (this.AUTO_REFRESH && this.ENABLE_CACHE) {
      setInterval(() => {
        this.refreshCache().catch(error => {
          console.error('Periodic cache refresh failed:', error);
        });
      }, this.TTL_MINUTES * 60 * 1000);
    }
  }

  /**
   * Get all active SOPs, loading from cache or database as needed
   */
  async getAllActiveSOPs(): Promise<SOPCacheEntry[]> {
    const startTime = Date.now();
    
    if (!this.ENABLE_CACHE) {
      // Cache disabled, fetch directly from database
      console.log('⚠️  SOP cache disabled, fetching from database');
      this.stats.cacheMisses++;
      const sopRecords = await HumanSOP.getAllActiveSOPs();
      const loadTime = Date.now() - startTime;
      console.log(`📊 Database fetch completed: ${sopRecords.length} SOPs in ${loadTime}ms`);
      return sopRecords.map(record => this.convertToEntry(record));
    }

    // Ensure cache is initialized
    await this.ensureInitialized();

    this.stats.cacheHits++;
    const result = Array.from(this.cache.values()).filter(entry => entry.isActive);
    const loadTime = Date.now() - startTime;
    
    console.log(`⚡ Cache hit: ${result.length} SOPs served in ${loadTime}ms (hit rate: ${Math.round(this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100)}%)`);
    return result;
  }

  /**
   * Get SOP by ID from cache
   */
  async getSOPById(sopId: string): Promise<SOPCacheEntry | null> {
    if (!this.ENABLE_CACHE) {
      // Cache disabled, fetch directly from database
      this.stats.cacheMisses++;
      const record = await HumanSOP.findBySopId(sopId);
      return record ? this.convertToEntry(record) : null;
    }

    await this.ensureInitialized();
    
    const entry = this.cache.get(sopId);
    if (entry) {
      this.stats.cacheHits++;
      return entry;
    }

    this.stats.cacheMisses++;
    return null;
  }

  /**
   * Get cache statistics
   */
  getStats(): SOPCacheStats {
    return {
      ...this.stats,
      memoryUsageMB: this.calculateMemoryUsage()
    };
  }

  /**
   * Manually refresh the cache
   */
  async refreshCache(): Promise<void> {
    if (!this.ENABLE_CACHE) {
      console.log('Cache refresh skipped - caching disabled');
      return;
    }

    console.log('Refreshing SOP cache...');
    const startTime = Date.now();

    try {
      const sopRecords = await HumanSOP.getAllActiveSOPs();
      
      // Clear existing cache
      this.cache.clear();
      
      // Populate with fresh data
      for (const record of sopRecords) {
        const entry = this.convertToEntry(record);
        this.cache.set(entry.sopId, entry);
      }

      this.stats.totalSOPs = this.cache.size;
      this.stats.lastRefresh = new Date();
      
      const duration = Date.now() - startTime;
      console.log(`SOP cache refreshed: ${this.cache.size} SOPs loaded in ${duration}ms`);

    } catch (error) {
      console.error('Failed to refresh SOP cache:', error);
      throw error;
    }
  }

  /**
   * Invalidate specific SOP in cache (optimized to avoid full refresh)
   */
  async invalidateSOPCache(sopId: string): Promise<void> {
    if (!this.ENABLE_CACHE) {
      return;
    }

    console.log(`🔄 Selective cache invalidation for SOP: ${sopId}`);
    
    try {
      // Remove from cache
      const wasRemoved = this.cache.delete(sopId);
      
      // Only fetch fresh data if it existed and we're not doing a full refresh soon
      if (wasRemoved) {
        const freshRecord = await HumanSOP.findBySopId(sopId);
        if (freshRecord && freshRecord.isActive) {
          const entry = this.convertToEntry(freshRecord);
          this.cache.set(sopId, entry);
          console.log(`✅ Cache updated for SOP: ${sopId}`);
        } else {
          console.log(`🗑️  SOP removed from cache: ${sopId}`);
        }
      } else {
        console.log(`ℹ️  SOP ${sopId} was not in cache, no action needed`);
      }

      this.stats.totalSOPs = this.cache.size;
      
    } catch (error) {
      console.error(`❌ Failed to invalidate cache for SOP ${sopId}:`, error);
      // On error, just remove from cache to be safe
      this.cache.delete(sopId);
      console.log(`🛡️  Removed ${sopId} from cache due to error`);
    }
  }

  /**
   * Warm the cache (load all SOPs)
   */
  async warmCache(): Promise<void> {
    if (!this.ENABLE_CACHE) {
      console.log('Cache warming skipped - caching disabled');
      return;
    }

    console.log('Warming SOP cache...');
    await this.refreshCache();
  }

  /**
   * Clear the entire cache
   */
  clearCache(): void {
    console.log('Clearing SOP cache');
    this.cache.clear();
    this.isInitialized = false;
    this.stats.totalSOPs = 0;
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }

  /**
   * Check if cache is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  // Private methods

  /**
   * Ensure cache is initialized, handling concurrent initialization
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.isInitializing && this.initializationPromise) {
      // Another initialization is in progress, wait for it
      await this.initializationPromise;
      return;
    }

    // Start initialization
    this.isInitializing = true;
    this.initializationPromise = this.initializeCache();
    
    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  /**
   * Initialize the cache by loading all SOPs
   */
  private async initializeCache(): Promise<void> {
    console.log('Initializing SOP cache...');
    const startTime = Date.now();

    try {
      await this.refreshCache();
      this.isInitialized = true;
      
      const duration = Date.now() - startTime;
      console.log(`SOP cache initialization complete: ${this.cache.size} SOPs in ${duration}ms`);
      
    } catch (error) {
      console.error('SOP cache initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Convert HumanSOPRecord to SOPCacheEntry
   */
  private convertToEntry(record: HumanSOPRecord): SOPCacheEntry {
    return {
      sopId: record.sopId,
      title: record.data.title,
      fullContent: record.data.markdownContent,
      summary: this.generateSummary(record.data.markdownContent),
      lastModified: record.updatedAt,
      isActive: record.isActive
    };
  }

  /**
   * Generate a summary of SOP content for quick assessment
   */
  private generateSummary(content: string): string {
    // Simple summary: first 500 characters + truncation
    // In the future, this could be enhanced with AI-generated summaries
    const maxLength = 500;
    
    if (content.length <= maxLength) {
      return content;
    }

    // Try to cut at sentence boundary
    const truncated = content.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }

    return truncated + '...';
  }

  /**
   * Calculate approximate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      // Rough calculation: each string character ≈ 2 bytes in memory
      totalSize += (entry.sopId.length + entry.title.length + 
                   entry.fullContent.length + entry.summary.length) * 2;
    }

    return Math.round(totalSize / 1024 / 1024 * 100) / 100; // MB with 2 decimal places
  }
}

// Singleton instance
export const sopCache = new SOPCacheManager();

// Export convenience functions
export const getAllActiveSOPs = () => sopCache.getAllActiveSOPs();
export const getSOPById = (sopId: string) => sopCache.getSOPById(sopId);
export const invalidateSOPCache = (sopId: string) => sopCache.invalidateSOPCache(sopId);
export const warmSOPCache = () => sopCache.warmCache();
export const clearSOPCache = () => sopCache.clearCache();
export const getSOPCacheStats = () => sopCache.getStats();
export const isSOPCacheReady = () => sopCache.isReady();