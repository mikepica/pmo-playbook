#!/usr/bin/env tsx

/**
 * Cache Performance Debugging Script
 * 
 * Helps identify cache performance issues and provides recommendations
 */

import { 
  getAllActiveSOPs, 
  getSOPCacheStats, 
  isSOPCacheReady, 
  clearSOPCache 
} from '../src/lib/sop-cache';
import { HumanSOP } from '../src/models/HumanSOP';

async function debugCachePerformance() {
  console.log('🔍 Cache Performance Debugging\n');
  
  // Test 1: Check initial cache state
  console.log('1. Initial Cache State:');
  const initialStats = getSOPCacheStats();
  console.log({
    isReady: isSOPCacheReady(),
    totalSOPs: initialStats.totalSOPs,
    memoryUsageMB: initialStats.memoryUsageMB,
    cacheHits: initialStats.cacheHits,
    cacheMisses: initialStats.cacheMisses
  });

  // Test 2: Compare database vs cache performance
  console.log('\n2. Performance Comparison:');
  
  // Clear cache to force database fetch
  clearSOPCache();
  
  // Time database fetch (first call - cache miss)
  console.log('Testing database fetch (cache miss)...');
  const dbStartTime = Date.now();
  const sopsFromDB = await getAllActiveSOPs();
  const dbTime = Date.now() - dbStartTime;
  
  console.log(`Database fetch: ${sopsFromDB.length} SOPs in ${dbTime}ms`);
  
  // Time cache fetch (second call - cache hit)
  console.log('Testing cache fetch (cache hit)...');
  const cacheStartTime = Date.now();
  const sopsFromCache = await getAllActiveSOPs();
  const cacheTime = Date.now() - cacheStartTime;
  
  console.log(`Cache fetch: ${sopsFromCache.length} SOPs in ${cacheTime}ms`);
  
  // Calculate improvement
  const speedup = Math.round((dbTime / cacheTime) * 100) / 100;
  const timeSaved = dbTime - cacheTime;
  
  console.log(`\n📊 Performance Analysis:`);
  console.log(`- Cache speedup: ${speedup}x faster`);
  console.log(`- Time saved: ${timeSaved}ms per query`);
  console.log(`- Cache efficiency: ${timeSaved > 0 ? 'GOOD' : 'POOR'}`);
  
  if (timeSaved <= 0) {
    console.log(`⚠️  WARNING: Cache is not improving performance!`);
    console.log(`   This suggests the cache overhead exceeds the database query time.`);
  }

  // Test 3: Memory usage analysis
  console.log('\n3. Memory Usage Analysis:');
  const finalStats = getSOPCacheStats();
  const avgSopSize = finalStats.memoryUsageMB / finalStats.totalSOPs;
  
  console.log({
    totalMemoryMB: finalStats.memoryUsageMB,
    averageSOPSizeMB: Math.round(avgSopSize * 1000) / 1000,
    totalSOPs: finalStats.totalSOPs
  });
  
  if (finalStats.memoryUsageMB > 50) {
    console.log(`⚠️  WARNING: High memory usage (${finalStats.memoryUsageMB}MB)`);
    console.log(`   Consider reducing SOP content size or disabling cache for large datasets.`);
  }

  // Test 4: Multiple query simulation
  console.log('\n4. Multiple Query Simulation:');
  const queryCount = 5;
  let totalTime = 0;
  
  for (let i = 1; i <= queryCount; i++) {
    const start = Date.now();
    await getAllActiveSOPs();
    const time = Date.now() - start;
    totalTime += time;
    console.log(`Query ${i}: ${time}ms`);
  }
  
  const avgTime = Math.round(totalTime / queryCount);
  console.log(`Average query time: ${avgTime}ms`);
  
  // Test 5: Direct database comparison
  console.log('\n5. Direct Database Comparison:');
  const directDBStart = Date.now();
  const directDBSOPs = await HumanSOP.getAllActiveSOPs();
  const directDBTime = Date.now() - directDBStart;
  
  console.log(`Direct database call: ${directDBSOPs.length} SOPs in ${directDBTime}ms`);
  console.log(`Cache overhead: ${avgTime - directDBTime}ms`);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (avgTime <= directDBTime + 5) {
    console.log('✅ Cache is working well - minimal overhead with good performance');
  } else if (avgTime <= directDBTime * 1.5) {
    console.log('⚠️  Cache has some overhead but may still be beneficial for repeated queries');
  } else {
    console.log('❌ Cache is adding significant overhead - consider disabling');
    console.log('   Possible causes:');
    console.log('   - Large SOP content causing memory pressure');
    console.log('   - Frequent cache refreshes');
    console.log('   - Database queries are already very fast');
  }
  
  console.log('\n🔧 Configuration Recommendations:');
  console.log('Environment variables to try:');
  
  if (finalStats.memoryUsageMB > 20) {
    console.log('- ENABLE_SOP_CACHE=false  (disable caching entirely)');
  }
  
  console.log('- SOP_CACHE_TTL_MINUTES=120  (increase cache lifetime)');
  console.log('- SOP_CACHE_AUTO_REFRESH=false  (disable auto-refresh)');
  
  // Final stats
  const currentStats = getSOPCacheStats();
  console.log('\n📈 Final Cache Stats:');
  console.log({
    totalHits: currentStats.cacheHits,
    totalMisses: currentStats.cacheMisses,
    hitRate: Math.round(currentStats.cacheHits / (currentStats.cacheHits + currentStats.cacheMisses) * 100) + '%',
    memoryUsageMB: currentStats.memoryUsageMB
  });
}

async function main() {
  try {
    await debugCachePerformance();
  } catch (error) {
    console.error('Debug script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as debugCachePerformance };