#!/usr/bin/env tsx

/**
 * Script to generate or regenerate the SOP directory
 * Run with: npm run generate-sop-directory or tsx scripts/generate-sop-directory.ts
 */

import { generateSOPDirectory, getSOPDirectoryPath } from '../src/lib/sop-directory-generator';

async function main() {
  try {
    console.log('🚀 Generating SOP directory...');
    
    await generateSOPDirectory();
    
    const directoryPath = getSOPDirectoryPath();
    console.log(`✅ SOP directory generated successfully at: ${directoryPath}`);
    
    console.log('\n📝 The directory will automatically update when SOPs are:');
    console.log('   - Created');
    console.log('   - Modified');
    console.log('   - Deleted');
    
    console.log('\n🔧 You can edit the directory file manually in the Admin Center');
    console.log('   Note: Manual changes will be overwritten on next auto-update');
    
  } catch (error) {
    console.error('❌ Failed to generate SOP directory:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}