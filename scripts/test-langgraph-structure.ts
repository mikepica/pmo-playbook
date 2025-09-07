/**
 * Simplified test for Phase 2: Core LangGraph Workflow (Tasks 2.1 and 2.2)
 * Tests structure and imports without database dependencies
 */

console.log('🧪 Testing Phase 2: Core LangGraph Workflow Structure\n');

async function testStateSchemaImport() {
  console.log('1. Testing State Schema Import...');
  
  try {
    const { createInitialState, StateHelpers, StateValidators } = await import('../src/lib/langgraph/state');
    
    console.log('   ✅ State schema imported successfully');
    
    // Test initial state creation
    const initialState = createInitialState(
      "Test query for structure validation",
      [{ role: 'user', content: 'Test context' }],
      'test-session-123'
    );
    
    console.log('   📋 Initial state created:');
    console.log('   - Query:', initialState.query.substring(0, 30) + '...');
    console.log('   - Session ID:', initialState.sessionId);
    console.log('   - Context length:', initialState.conversationContext.length);
    console.log('   - Current node:', initialState.currentNode);
    console.log('   - Start time set:', !!initialState.metadata.startTime);
    
    // Test validators (without database calls)
    console.log('   🔍 Testing validators:');
    console.log('   - Has valid query:', StateValidators.hasValidQuery(initialState));
    console.log('   - Has SOP references:', StateValidators.hasSOPReferences(initialState));
    console.log('   - Has errors:', StateValidators.hasErrors(initialState));
    
    // Test helpers
    console.log('   🛠️ Testing helpers:');
    let testState = StateHelpers.addConfidenceEntry(
      initialState,
      'test-node',
      0.75,
      'Test confidence entry'
    );
    
    console.log('   - Confidence entries:', testState.metadata.confidenceHistory.length);
    console.log('   - Latest confidence:', testState.metadata.confidenceHistory[0]?.confidence);
    
    testState = StateHelpers.markNodeComplete(testState, 'test-node');
    console.log('   - Completed nodes:', testState.completedNodes.length);
    
    console.log('   ✅ State schema structure test passed\n');
    return true;
    
  } catch (error) {
    console.log('   ❌ State schema import failed:', error);
    return false;
  }
}

async function testNodeFileExistence() {
  console.log('2. Testing Node File Existence...');
  
  const fs = await import('fs');
  const path = await import('path');
  
  const nodeFiles = [
    'queryAnalysisNode.ts',
    'sopAssessmentNode.ts', 
    'coverageEvaluationNode.ts',
    'responseSynthesisNode.ts'
  ];
  
  let allExist = true;
  
  for (const nodeFile of nodeFiles) {
    const filePath = path.resolve('src/lib/langgraph/nodes', nodeFile);
    const exists = fs.existsSync(filePath);
    console.log(`   - ${nodeFile}: ${exists ? '✅' : '❌'}`);
    if (!exists) allExist = false;
  }
  
  console.log('   ✅ Node file existence test', allExist ? 'passed' : 'failed');
  console.log();
  return allExist;
}

async function testLangChainImports() {
  console.log('3. Testing LangChain Dependencies...');
  
  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    console.log('   - @langchain/openai: ✅');
    
    const { StateGraph } = await import('@langchain/langgraph');
    console.log('   - @langchain/langgraph: ✅');
    
    console.log('   ✅ LangChain imports successful\n');
    return true;
    
  } catch (error) {
    console.log('   ❌ LangChain import failed:', error);
    return false;
  }
}

async function testDirectoryStructure() {
  console.log('4. Testing Directory Structure...');
  
  const fs = await import('fs');
  const path = await import('path');
  
  const requiredPaths = [
    'src/lib/langgraph',
    'src/lib/langgraph/nodes'
  ];
  
  let allExist = true;
  
  for (const dirPath of requiredPaths) {
    const exists = fs.existsSync(path.resolve(dirPath));
    console.log(`   - ${dirPath}: ${exists ? '✅' : '❌'}`);
    if (!exists) allExist = false;
  }
  
  console.log('   ✅ Directory structure test', allExist ? 'passed' : 'failed');
  console.log();
  return allExist;
}

async function testTypeScript() {
  console.log('5. Testing TypeScript Compilation...');
  
  try {
    // Test that our files compile without errors
    const { execSync } = await import('child_process');
    
    // Only check our new files for compilation
    const files = [
      'src/lib/langgraph/state.ts',
      'src/lib/langgraph/nodes/queryAnalysisNode.ts',
      'src/lib/langgraph/nodes/sopAssessmentNode.ts',
      'src/lib/langgraph/nodes/coverageEvaluationNode.ts',
      'src/lib/langgraph/nodes/responseSynthesisNode.ts'
    ];
    
    for (const file of files) {
      try {
        execSync(`npx tsc --noEmit ${file}`, { stdio: 'pipe' });
        console.log(`   - ${file}: ✅`);
      } catch (error) {
        console.log(`   - ${file}: ❌ (compilation error)`);
        return false;
      }
    }
    
    console.log('   ✅ TypeScript compilation test passed\n');
    return true;
    
  } catch (error) {
    console.log('   ❌ TypeScript test failed:', error);
    return false;
  }
}

// Main test execution
async function runStructureTests() {
  console.log('🚀 Starting Phase 2 Structure Tests (Tasks 2.1 and 2.2)\n');
  
  const results = [];
  
  results.push(await testDirectoryStructure());
  results.push(await testNodeFileExistence());
  results.push(await testLangChainImports());
  results.push(await testStateSchemaImport());
  results.push(await testTypeScript());
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('📊 Test Results Summary:');
  console.log(`   ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('   ✅ All structure tests passed!');
    console.log('\n🎉 Phase 2 Tasks 2.1 and 2.2 Structure Verification Complete!');
    console.log('\n📝 What was verified:');
    console.log('   ✅ Directory structure created correctly');
    console.log('   ✅ All node files exist');
    console.log('   ✅ LangChain dependencies available');
    console.log('   ✅ State schema working correctly');
    console.log('   ✅ TypeScript compilation successful');
    console.log('\n🚀 Ready for next steps:');
    console.log('   - Task 2.3: Implement enhanced nodes');
    console.log('   - Task 2.4: Build workflow graph');
    console.log('   - Task 2.5: Add checkpointing');
    console.log('   - Task 2.6: Create LangGraph processor');
  } else {
    console.log('   ❌ Some tests failed - check implementation');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runStructureTests().catch(console.error);
}