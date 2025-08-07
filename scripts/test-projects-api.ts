import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testProjectsAPI() {
  const baseUrl = 'http://localhost:3002';
  
  try {
    console.log('🧪 Testing Projects API with PostgreSQL...\n');
    
    // Test GET all projects
    console.log('1. Testing GET /api/projects');
    const getResponse = await fetch(`${baseUrl}/api/projects`);
    
    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log(`   ✅ GET successful: ${data.projects?.length || 0} projects found`);
      
      if (data.projects?.length > 0) {
        console.log(`   📋 Sample project: ${data.projects[0].projectName} (${data.projects[0].projectId})`);
      }
    } else {
      console.log(`   ❌ GET failed: ${getResponse.status}`);
      const error = await getResponse.text();
      console.log(`   Error: ${error}`);
      return;
    }
    
    // Test POST create new project
    console.log('\n2. Testing POST /api/projects');
    const testProject = {
      projectName: 'Test PostgreSQL Project',
      sponsor: 'Test Sponsor',
      businessCaseSummary: 'Testing PostgreSQL integration',
      resourceRequirements: 'PostgreSQL database and API testing',
      projectTeam: ['Test Developer'],
      projectObjectives: ['Test database migration', 'Verify API functionality']
    };
    
    const postResponse = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testProject)
    });
    
    if (postResponse.ok) {
      const data = await postResponse.json();
      console.log(`   ✅ POST successful: Created project ${data.project?.projectId}`);
      console.log(`   📋 Project name: ${data.project?.projectName}`);
      
      // Test GET specific project by ID
      const createdProjectId = data.project?.projectId;
      if (createdProjectId) {
        console.log('\n3. Testing GET active projects only');
        const activeResponse = await fetch(`${baseUrl}/api/projects?active=true`);
        
        if (activeResponse.ok) {
          const activeData = await activeResponse.json();
          console.log(`   ✅ Active projects query successful: ${activeData.projects?.length || 0} active projects`);
          
          const foundProject = activeData.projects?.find(p => p.projectId === createdProjectId);
          if (foundProject) {
            console.log(`   ✅ Created project found in active projects list`);
          } else {
            console.log(`   ⚠️  Created project not found in active projects list`);
          }
        }
      }
    } else {
      console.log(`   ❌ POST failed: ${postResponse.status}`);
      const error = await postResponse.text();
      console.log(`   Error: ${error}`);
    }
    
    // Test database configuration
    console.log('\n4. Testing database configuration');
    console.log(`   Database provider for projects: ${process.env.USE_POSTGRES_PROJECTS === 'true' ? 'PostgreSQL' : 'MongoDB'}`);
    
    console.log('\n🎉 Projects API test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
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
    console.log('❌ Server not running. Please start the dev server first:');
    console.log('   npm run dev');
    process.exit(1);
  }
  
  await testProjectsAPI();
}

runTest();