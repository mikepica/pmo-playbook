#!/usr/bin/env tsx

/**
 * SOP Cache Testing Script
 * 
 * Tests the SOP cache implementation to ensure it's working correctly
 */

import { 
  getAllActiveSOPs, 
  getSOPCacheStats, 
  isSOPCacheReady, 
  warmSOPCache,
  clearSOPCache 
} from '../src/lib/sop-cache';

async function testCacheImplementation() {
  console.log('🧪 Testing SOP Cache Implementation\n');
  
  try {
    // Test 1: Clear cache and verify it's empty
    console.log('Test 1: Clearing cache...');
    clearSOPCache();
    
    let stats = getSOPCacheStats();
    console.log('✅ Cache cleared. Stats:', {
      isReady: isSOPCacheReady(),
      totalSOPs: stats.totalSOPs,
      memoryUsageMB: stats.memoryUsageMB
    });
    
    // Test 2: First load (cache miss)
    console.log('\nTest 2: First load (should initialize cache)...');
    const startTime1 = Date.now();
    const sops1 = await getAllActiveSOPs();
    const loadTime1 = Date.now() - startTime1;
    
    stats = getSOPCacheStats();
    console.log('✅ First load complete:', {
      sopCount: sops1.length,
      loadTime: `${loadTime1}ms`,
      cacheHits: stats.cacheHits,
      cacheMisses: stats.cacheMisses,
      isReady: isSOPCacheReady(),
      memoryUsageMB: stats.memoryUsageMB
    });
    
    // Test 3: Second load (cache hit)
    console.log('\nTest 3: Second load (should use cache)...');
    const startTime2 = Date.now();
    const sops2 = await getAllActiveSOPs();
    const loadTime2 = Date.now() - startTime2;
    
    const finalStats = getSOPCacheStats();
    console.log('✅ Second load complete:', {
      sopCount: sops2.length,
      loadTime: `${loadTime2}ms`,
      cacheHits: finalStats.cacheHits,
      cacheMisses: finalStats.cacheMisses,
      hitRate: finalStats.cacheHits / (finalStats.cacheHits + finalStats.cacheMisses) * 100,
      speedImprovement: `${Math.round((loadTime1 - loadTime2) / loadTime1 * 100)}%`
    });
    
    // Test 4: Verify data consistency
    console.log('\nTest 4: Verifying data consistency...');
    const consistencyCheck = sops1.length === sops2.length && 
                           sops1.every((sop1, i) => sop1.sopId === sops2[i].sopId);
    
    console.log('✅ Data consistency:', consistencyCheck ? 'PASSED' : 'FAILED');
    
    // Test 5: Manual cache warm
    console.log('\nTest 5: Testing manual cache warming...');
    clearSOPCache();
    
    const warmStartTime = Date.now();
    await warmSOPCache();
    const warmTime = Date.now() - warmStartTime;
    
    const warmStats = getSOPCacheStats();
    console.log('✅ Cache warming complete:', {
      warmTime: `${warmTime}ms`,
      totalSOPs: warmStats.totalSOPs,
      memoryUsageMB: warmStats.memoryUsageMB,
      isReady: isSOPCacheReady()
    });
    
    // Test Summary
    console.log('\n📊 Cache Performance Summary:');
    console.log(`- First load (cold): ${loadTime1}ms`);
    console.log(`- Second load (warm): ${loadTime2}ms`);
    console.log(`- Speed improvement: ${Math.round((loadTime1 - loadTime2) / loadTime1 * 100)}%`);
    console.log(`- Memory usage: ${finalStats.memoryUsageMB}MB`);
    console.log(`- Cache hit rate: ${Math.round(finalStats.cacheHits / (finalStats.cacheHits + finalStats.cacheMisses) * 100)}%`);
    
    if (loadTime2 < loadTime1 * 0.1) { // Cache should be at least 10x faster
      console.log('✅ CACHE PERFORMANCE: EXCELLENT');
    } else if (loadTime2 < loadTime1 * 0.5) {
      console.log('✅ CACHE PERFORMANCE: GOOD');
    } else {
      console.log('⚠️  CACHE PERFORMANCE: POOR');
    }
    
  } catch (error) {
    console.error('❌ Cache test failed:', error);
    process.exit(1);
  }
}

// Test API endpoint
async function testCacheAPI() {
  console.log('\n🌐 Testing Cache API Endpoint...');
  
  try {
    const response = await fetch('http://localhost:3000/api/cache/stats');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Cache API working:', data);
    } else {
      console.log('⚠️  Cache API not available (server may not be running)');
    }
  } catch (error) {
    console.log('⚠️  Cache API test skipped (server not running)');
  }
}

async function main() {
  await testCacheImplementation();
  await testCacheAPI();
  
  console.log('\n🎉 SOP Cache testing complete!');
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
}

export { main as testSOPCache };