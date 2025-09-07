/**
 * Script to toggle between LangGraph and Unified processors
 */

import * as fs from 'fs';
import * as path from 'path';

const ENV_FILE_PATH = path.resolve('.env.local');

function readEnvFile(): string {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    console.error('❌ .env.local file not found');
    process.exit(1);
  }
  
  return fs.readFileSync(ENV_FILE_PATH, 'utf-8');
}

function writeEnvFile(content: string): void {
  fs.writeFileSync(ENV_FILE_PATH, content, 'utf-8');
}

function getCurrentProcessor(): 'langgraph' | 'unified' {
  const envContent = readEnvFile();
  const match = envContent.match(/ENABLE_LANGGRAPH_PROCESSOR=(true|false)/);
  
  if (!match) {
    console.error('❌ ENABLE_LANGGRAPH_PROCESSOR not found in .env.local');
    process.exit(1);
  }
  
  return match[1] === 'true' ? 'langgraph' : 'unified';
}

function setProcessor(processor: 'langgraph' | 'unified'): void {
  const envContent = readEnvFile();
  const newValue = processor === 'langgraph' ? 'true' : 'false';
  
  const updatedContent = envContent.replace(
    /ENABLE_LANGGRAPH_PROCESSOR=(true|false)/,
    `ENABLE_LANGGRAPH_PROCESSOR=${newValue}`
  );
  
  writeEnvFile(updatedContent);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('🔧 Processor Toggle Utility\n');
    console.log('Usage:');
    console.log('  npm run processor:status    - Show current processor');
    console.log('  npm run processor:langgraph - Switch to LangGraph processor');  
    console.log('  npm run processor:unified   - Switch to Unified processor');
    console.log('  npm run processor:toggle    - Toggle between processors');
    return;
  }
  
  const currentProcessor = getCurrentProcessor();
  
  switch (command) {
    case 'status':
      console.log(`🔍 Current processor: ${currentProcessor.toUpperCase()}`);
      console.log(`   Environment: ENABLE_LANGGRAPH_PROCESSOR=${currentProcessor === 'langgraph'}`);
      console.log(`   API will use: ${currentProcessor === 'langgraph' ? 'LangGraph workflow' : 'Unified query processor'}`);
      break;
      
    case 'langgraph':
      if (currentProcessor === 'langgraph') {
        console.log('✅ Already using LangGraph processor');
      } else {
        setProcessor('langgraph');
        console.log('✅ Switched to LangGraph processor');
        console.log('   🔄 Restart your dev server (npm run dev) to apply changes');
      }
      break;
      
    case 'unified': 
      if (currentProcessor === 'unified') {
        console.log('✅ Already using Unified processor');
      } else {
        setProcessor('unified');
        console.log('✅ Switched to Unified processor');
        console.log('   🔄 Restart your dev server (npm run dev) to apply changes');
      }
      break;
      
    case 'toggle':
      const newProcessor = currentProcessor === 'langgraph' ? 'unified' : 'langgraph';
      setProcessor(newProcessor);
      console.log(`🔄 Toggled from ${currentProcessor.toUpperCase()} to ${newProcessor.toUpperCase()}`);
      console.log('   🔄 Restart your dev server (npm run dev) to apply changes');
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
  }
}

main();