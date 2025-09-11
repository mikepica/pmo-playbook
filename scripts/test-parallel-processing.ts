#!/usr/bin/env tsx

/**
 * Parallel Processing Testing Script
 * 
 * Tests the parallel processing optimizations to measure performance improvements
 */

import { 
  runInParallel, 
  loadSOPsWithTiming, 
  isParallelProcessingEnabled,
  getParallelConfig
} from '../src/lib/langgraph/parallel-utils';

async function simulateQueryAnalysis(): Promise<string> {
  // Simulate an LLM call that takes some time
  const delay = Math.random() * 1000 + 500; // 500-1500ms
  await new Promise(resolve => setTimeout(resolve, delay));
  return `Query analysis result after ${Math.round(delay)}ms`;
}

async function simulateSlowOperation(name: string, duration: number): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, duration));
  return `${name} completed after ${duration}ms`;
}

async function testParallelProcessing() {
  console.log('🧪 Testing Parallel Processing Optimizations\n');
  
  // Test 1: Check configuration
  console.log('1. Parallel Processing Configuration:');
  const config = getParallelConfig();
  console.log({
    enabled: config.enabled,
    timeout: config.timeout,
    sopPreloading: config.sopPreloading,
    maxConcurrency: config.maxConcurrency
  });
  
  if (!config.enabled) {
    console.log('⚠️  Parallel processing is disabled. Enable with ENABLE_PARALLEL_PROCESSING=true');
    return;
  }
  
  // Test 2: Compare sequential vs parallel SOP loading and query analysis
  console.log('\n2. Sequential vs Parallel Performance Comparison:');
  
  // Sequential execution
  console.log('\n   Sequential Execution:');
  const seqStartTime = Date.now();
  
  console.log('     Running query analysis...');
  const seqQueryStart = Date.now();
  const seqQueryResult = await simulateQueryAnalysis();
  const seqQueryTime = Date.now() - seqQueryStart;
  console.log(`     Query analysis: ${seqQueryTime}ms`);
  
  console.log('     Loading SOPs...');
  const seqSOPStart = Date.now();
  const seqSOPResult = await loadSOPsWithTiming();
  const seqSOPTime = Date.now() - seqSOPStart;
  console.log(`     SOP loading: ${seqSOPTime}ms`);
  
  const seqTotalTime = Date.now() - seqStartTime;
  console.log(`     Sequential Total: ${seqTotalTime}ms`);
  
  // Parallel execution
  console.log('\n   Parallel Execution:');
  const parStartTime = Date.now();
  
  const parallelResults = await runInParallel({
    queryAnalysis: simulateQueryAnalysis(),
    sopLoading: loadSOPsWithTiming()
  }, {
    timeout: 30000,
    failFast: false,
    logResults: true
  });
  
  const parTotalTime = Date.now() - parStartTime;
  console.log(`     Parallel Total: ${parTotalTime}ms`);
  
  // Analysis
  const improvement = Math.round((seqTotalTime - parTotalTime) / seqTotalTime * 100);
  const timeSaved = seqTotalTime - parTotalTime;
  
  console.log('\n   📊 Performance Analysis:');
  console.log(`     Time saved: ${timeSaved}ms`);
  console.log(`     Speed improvement: ${improvement}%`);
  console.log(`     Parallel efficiency: ${improvement > 20 ? 'EXCELLENT' : improvement > 10 ? 'GOOD' : 'POOR'}`);
  
  // Test 3: Error handling and timeout
  console.log('\n3. Error Handling and Timeout Testing:');
  
  const errorTestResults = await runInParallel({
    fastOperation: simulateSlowOperation('Fast', 100),
    slowOperation: simulateSlowOperation('Slow', 2000),
    failingOperation: Promise.reject(new Error('Simulated failure'))
  }, {
    timeout: 1500, // 1.5 seconds
    failFast: false,
    logResults: true
  });
  
  console.log('\n   Error Test Results:');
  Object.entries(errorTestResults).forEach(([operation, result]) => {
    console.log(`     ${operation}: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.duration}ms)`);
    if (!result.success && result.error) {
      console.log(`       Error: ${result.error.message}`);
    }
  });
  
  // Test 4: Concurrency limits
  console.log('\n4. Concurrency Stress Test:');
  const manyOperations: Record<string, Promise<string>> = {};
  
  for (let i = 1; i <= 10; i++) {
    manyOperations[`operation${i}`] = simulateSlowOperation(`Op${i}`, Math.random() * 500 + 200);
  }
  
  const stressStartTime = Date.now();
  const stressResults = await runInParallel(manyOperations, {
    timeout: 5000,
    failFast: false,
    logResults: false
  });
  const stressEndTime = Date.now();
  
  const successCount = Object.values(stressResults).filter(r => r.success).length;
  const failureCount = Object.values(stressResults).filter(r => !r.success).length;
  
  console.log(`   Stress test completed in ${stressEndTime - stressStartTime}ms:`);
  console.log(`     Successful operations: ${successCount}/10`);
  console.log(`     Failed operations: ${failureCount}/10`);
  
  // Test 5: Real SOP loading performance
  console.log('\n5. Real SOP Loading Performance:');
  
  const realSOPStart = Date.now();
  const realSOPResult = await loadSOPsWithTiming();
  const realSOPTime = Date.now() - realSOPStart;
  
  console.log(`   SOP loading: ${realSOPTime}ms`);
  console.log(`   SOPs loaded: ${realSOPResult.result.sopEntries.length}`);
  console.log(`   Success: ${realSOPResult.success}`);
  console.log(`   Memory usage: ${realSOPResult.result.cacheStats.memoryUsageMB}MB`);
  
  if (realSOPTime > 1000) {
    console.log('   ⚠️  SOP loading is slow - consider cache optimization');
  } else if (realSOPTime < 100) {
    console.log('   ✅ SOP loading is very fast - parallel processing will show good benefits');
  } else {
    console.log('   ✅ SOP loading performance is reasonable');
  }
  
  // Summary and recommendations
  console.log('\n💡 Parallel Processing Recommendations:');
  
  if (improvement > 20) {
    console.log('✅ Parallel processing is highly effective for your setup');
    console.log('   - Keep parallel processing enabled in production');
    console.log('   - Consider increasing concurrency limits if needed');
  } else if (improvement > 10) {
    console.log('✅ Parallel processing provides moderate benefits');
    console.log('   - Parallel processing is worth keeping enabled');
    console.log('   - Monitor performance in production');
  } else if (improvement > 0) {
    console.log('⚠️  Parallel processing provides minimal benefits');
    console.log('   - Consider disabling for reduced complexity');
    console.log('   - Check if operations are too fast to benefit from parallelization');
  } else {
    console.log('❌ Parallel processing may be adding overhead');
    console.log('   - Consider disabling: ENABLE_PARALLEL_PROCESSING=false');
    console.log('   - Operations may be too fast or network-bound');
  }
  
  console.log('\n🔧 Configuration Recommendations:');
  console.log('Environment variables to try:');
  
  if (realSOPTime < 200) {
    console.log('- ENABLE_PARALLEL_PROCESSING=false  (SOPs load too quickly to benefit)');
  } else {
    console.log('- ENABLE_PARALLEL_PROCESSING=true   (keep parallel processing enabled)');
  }
  
  console.log('- PARALLEL_TIMEOUT_MS=30000         (adjust timeout as needed)');
  console.log('- MAX_PARALLEL_OPERATIONS=3          (adjust concurrency limits)');
}

async function main() {
  try {
    await testParallelProcessing();
    console.log('\n🎉 Parallel processing testing complete!');
  } catch (error) {
    console.error('Test script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as testParallelProcessing };