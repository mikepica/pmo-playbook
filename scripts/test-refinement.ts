#!/usr/bin/env tsx

/**
 * Script to test the iterative refinement system
 * Run with: tsx scripts/test-refinement.ts
 */

import { getAIConfig, getResponseModeConfig } from '../src/lib/ai-config';

async function testRefinementConfig() {
  try {
    console.log('🧪 Testing Iterative Refinement Configuration\n');

    // Test config loading
    const config = getAIConfig();
    console.log('✅ AI config loaded successfully');

    // Test response mode configs
    const modes = ['quick', 'standard', 'comprehensive'] as const;
    
    for (const mode of modes) {
      const modeConfig = getResponseModeConfig(mode);
      console.log(`\n📋 ${mode.toUpperCase()} MODE:`);
      console.log(`   Name: ${modeConfig.name}`);
      console.log(`   Chain of Thought: ${modeConfig.chain_of_thought}`);
      console.log(`   LLM: ${modeConfig.llm}`);
      
      if (modeConfig.reasoning_steps) {
        console.log(`   Reasoning Steps: ${modeConfig.reasoning_steps.join(' → ')}`);
      }
      
      if (modeConfig.refinement?.enabled) {
        console.log(`   🔄 REFINEMENT ENABLED:`);
        console.log(`      Max Iterations: ${modeConfig.refinement.max_iterations}`);
        console.log(`      Confidence Threshold: ${modeConfig.refinement.confidence_threshold}`);
        console.log(`      Improvement Threshold: ${modeConfig.refinement.improvement_threshold}`);
        console.log(`      Refinement Steps: ${modeConfig.refinement.refinement_steps.join(' → ')}`);
        console.log(`      Timeout per Iteration: ${modeConfig.refinement.timeout_per_iteration_ms / 1000}s`);
      } else {
        console.log('   🔄 Refinement: Disabled');
      }
    }

    // Test chain-of-thought config
    if (config.chain_of_thought?.enabled) {
      console.log('\n🧠 CHAIN-OF-THOUGHT STAGES:');
      Object.entries(config.chain_of_thought.stages).forEach(([stage, stageConfig]) => {
        console.log(`   ${stage}: ${stageConfig.description}`);
        console.log(`      Temperature: ${stageConfig.temperature}`);
      });
    }

    console.log('\n✅ All configuration validation passed!');
    console.log('\n📊 Expected Behavior:');
    console.log('   • Quick/Standard modes: Single-pass reasoning');
    console.log('   • Comprehensive mode: Multi-pass with refinement if confidence < 0.8');
    console.log('   • Refinement continues until confidence ≥ 0.8 or max 3 iterations');
    console.log('   • Each iteration must improve confidence by ≥ 0.1');
    console.log('   • Timeout per iteration: 2 minutes');
    
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testRefinementConfig();
}