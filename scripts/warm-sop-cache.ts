#!/usr/bin/env tsx

/**
 * SOP Cache Warming Script
 * 
 * This script can be used to warm the SOP cache on server startup
 * or run manually to pre-load SOPs into memory.
 */

import { warmSOPCache, getSOPCacheStats, isSOPCacheReady } from '../src/lib/sop-cache';

async function main() {
  console.log('🔥 Starting SOP cache warming...');
  
  try {
    const startTime = Date.now();
    
    // Check if cache is already ready
    if (isSOPCacheReady()) {
      console.log('✅ SOP cache is already warm');
      return;
    }
    
    // Warm the cache
    await warmSOPCache();
    
    // Get final stats
    const stats = getSOPCacheStats();
    const duration = Date.now() - startTime;
    
    console.log('✅ SOP cache warming complete!');
    console.log(`📊 Cache Stats:`, {
      totalSOPs: stats.totalSOPs,
      memoryUsageMB: stats.memoryUsageMB,
      warmingTime: `${duration}ms`,
      lastRefresh: stats.lastRefresh.toISOString()
    });
    
    if (stats.totalSOPs === 0) {
      console.warn('⚠️  Warning: No SOPs found in database');
    }
    
  } catch (error) {
    console.error('❌ Failed to warm SOP cache:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export { main as warmSOPCache };