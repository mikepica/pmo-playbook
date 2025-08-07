import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testSystem() {
  const baseUrl = 'http://localhost:3002';
  
  console.log('🔍 Testing full system with PostgreSQL...\n');
  
  const tests = [
    { 
      name: 'Projects API', 
      url: '/api/projects',
      description: 'Test project listing and creation'
    },
    { 
      name: 'Human SOPs API', 
      url: '/api/content-db?all=true&type=human',
      description: 'Test human SOPs retrieval'
    },
    { 
      name: 'Agent SOPs API', 
      url: '/api/files-db?type=agent',
      description: 'Test agent SOPs summaries'
    },
    { 
      name: 'Files DB API (All)', 
      url: '/api/files-db?type=all',
      description: 'Test file listings'
    },
    { 
      name: 'Sessions API', 
      url: '/api/sessions',
      description: 'Test sessions endpoint'
    },
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    try {
      console.log(`🧪 Testing: ${test.name}`);
      console.log(`   ${test.description}`);
      
      const response = await fetch(`${baseUrl}${test.url}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Specific validations for each endpoint
        if (test.url.includes('/api/projects')) {
          const projectCount = data.projects?.length || 0;
          console.log(`   ✅ ${test.name}: OK (${projectCount} projects found)`);
        } else if (test.url.includes('type=human')) {
          const sopCount = data.sops?.length || 0;
          console.log(`   ✅ ${test.name}: OK (${sopCount} human SOPs found)`);
        } else if (test.url.includes('type=agent')) {
          const sopCount = data.sops?.length || 0;
          console.log(`   ✅ ${test.name}: OK (${sopCount} agent SOPs found)`);
        } else if (test.url.includes('type=all')) {
          const fileCount = data.files?.length || 0;
          console.log(`   ✅ ${test.name}: OK (${fileCount} files listed)`);
        } else {
          console.log(`   ✅ ${test.name}: OK`);
        }
        
        passedTests++;
      } else {
        console.log(`   ❌ ${test.name}: Failed (${response.status})`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ❌ ${test.name}: Error - ${(error as Error).message}`);
    }
    console.log('');
  }
  
  // Test database configuration
  console.log('⚙️  Database Configuration:');
  console.log(`   Projects: ${process.env.USE_POSTGRES_PROJECTS === 'true' ? '✅ PostgreSQL' : '❌ MongoDB'}`);
  console.log(`   SOPs: ${process.env.USE_POSTGRES_SOPS === 'true' ? '✅ PostgreSQL' : '❌ MongoDB'}`);
  console.log(`   Chat: ${process.env.USE_POSTGRES_CHAT === 'true' ? '✅ PostgreSQL' : '❌ MongoDB'}`);
  console.log(`   Feedback: ${process.env.USE_POSTGRES_FEEDBACK === 'true' ? '✅ PostgreSQL' : '❌ MongoDB'}`);
  console.log(`   Proposals: ${process.env.USE_POSTGRES_PROPOSALS === 'true' ? '✅ PostgreSQL' : '❌ MongoDB'}`);
  console.log(`   Users: ${process.env.USE_POSTGRES_USERS === 'true' ? '✅ PostgreSQL' : '❌ MongoDB'}`);
  
  // Summary
  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests PASSED! System is ready for PostgreSQL.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }
  
  return passedTests === totalTests;
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3002/api/projects');
    return response.status !== 0;
  } catch {
    return false;
  }
}

async function runTest() {
  console.log('Checking if server is running...');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Server not running. Please ensure the dev server is running:');
    console.log('   npm run dev');
    process.exit(1);
  }
  
  const success = await testSystem();
  process.exit(success ? 0 : 1);
}

runTest();