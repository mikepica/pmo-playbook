import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { connectToDatabase } from '../src/lib/mongodb';
import { selectBestSOP, generateAnswer } from '../src/lib/ai-sop-selection';

async function testAISelection() {
  try {
    console.log('🧪 Testing AI SOP Selection System...\n');
    
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.log('⚠️  OpenAI API key not configured. This test requires a valid API key.');
      console.log('Please set OPENAI_API_KEY in .env.local to test the AI features.\n');
      
      // Show what would happen with mock data
      console.log('📋 Mock Test Results:');
      const testQueries = [
        'How do I create a business case?',
        'What do I need for project kick-off?',
        'How do I plan project resources?',
        'What reports should I create during execution?',
        'How do I close a project?'
      ];
      
      testQueries.forEach((query, i) => {
        const expectedPhase = i + 1;
        console.log(`${i + 1}. "${query}"`);
        console.log(`   Expected: Phase ${expectedPhase} SOP`);
        console.log('');
      });
      
      return;
    }
    
    // Connect to database
    await connectToDatabase();
    console.log('✅ Connected to MongoDB\n');
    
    // Test queries that should map to each phase
    const testQueries = [
      { query: 'How do I create a business case for a new project?', expectedPhase: 1 },
      { query: 'What do I need to do to kick off a project?', expectedPhase: 2 },
      { query: 'How do I plan project resources and timeline?', expectedPhase: 3 },
      { query: 'What reports should I create during project execution?', expectedPhase: 4 },
      { query: 'How do I properly close out a completed project?', expectedPhase: 5 }
    ];
    
    console.log('🔍 Testing SOP Selection for Different Queries:\n');
    
    for (const test of testQueries) {
      console.log(`📝 Query: "${test.query}"`);
      
      try {
        // Step A: SOP Selection
        const selection = await selectBestSOP(test.query);
        console.log(`🎯 Selected: ${selection.selectedSopId}`);
        console.log(`📊 Confidence: ${Math.round(selection.confidence * 100)}%`);
        console.log(`💭 Reasoning: ${selection.reasoning}`);
        
        // Check if it matches expected phase
        const selectedPhase = parseInt(selection.selectedSopId.split('-')[1]);
        const isCorrect = selectedPhase === test.expectedPhase;
        console.log(`✅ Expected Phase ${test.expectedPhase}, Got Phase ${selectedPhase} ${isCorrect ? '✓' : '✗'}`);
        
        // Step B: Answer Generation (abbreviated)
        console.log('🤖 Generating answer...');
        const answer = await generateAnswer(test.query, selection.selectedSopId);
        console.log(`📄 Answer length: ${answer.answer.length} characters`);
        console.log(`🔧 Suggested change: ${answer.suggestedChange ? 'Yes' : 'No'}`);
        
      } catch (error) {
        console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      console.log('─'.repeat(60));
      console.log('');
    }
    
    console.log('🎉 AI Selection testing complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

testAISelection();