import { NextResponse } from 'next/server';
import { getSOPCacheStats, isSOPCacheReady } from '@/lib/sop-cache';

/**
 * GET /api/cache/stats
 * 
 * Returns current SOP cache statistics for monitoring
 */
export async function GET() {
  try {
    const stats = getSOPCacheStats();
    const isReady = isSOPCacheReady();
    
    return NextResponse.json({
      cache: {
        isReady,
        totalSOPs: stats.totalSOPs,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        hitRate: stats.cacheHits + stats.cacheMisses > 0 
          ? Math.round((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100) 
          : 0,
        memoryUsageMB: stats.memoryUsageMB,
        lastRefresh: stats.lastRefresh.toISOString()
      },
      system: {
        nodeEnv: process.env.NODE_ENV,
        cacheEnabled: process.env.ENABLE_SOP_CACHE !== 'false',
        cacheTTL: process.env.SOP_CACHE_TTL_MINUTES || '5',
        autoRefresh: process.env.SOP_CACHE_AUTO_REFRESH !== 'false'
      }
    });
    
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    
    return NextResponse.json({
      error: 'Failed to retrieve cache statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}