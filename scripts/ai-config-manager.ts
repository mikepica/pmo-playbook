#!/usr/bin/env tsx
/**
 * AI Configuration Management CLI
 * 
 * Usage:
 * npm run ai-config validate    # Validate configuration
 * npm run ai-config test        # Test configuration with sample data
 * npm run ai-config export      # Export configuration to JSON
 * npm run ai-config reload      # Force reload (dev only)
 * npm run ai-config preview     # Preview prompts with sample data
 */

import { aiConfig } from '../src/lib/ai-config';
import { TemplateUtils, TemplateEngine } from '../src/lib/template-engine';
import fs from 'fs';
import path from 'path';

const command = process.argv[2];

async function validateConfig() {
  console.log('🔍 Validating AI configuration...\n');
  
  try {
    const config = aiConfig.loadConfig('development');
    console.log('✅ Configuration loaded successfully');
    
    // Validate prompts
    const promptErrors: string[] = [];
    Object.entries(config.prompts).forEach(([name, template]) => {
      const validation = TemplateUtils.validateTemplate(template);
      if (!validation.valid) {
        promptErrors.push(`${name}: ${validation.errors.join(', ')}`);
      }
    });
    
    if (promptErrors.length > 0) {
      console.log('\n❌ Prompt validation errors:');
      promptErrors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('✅ All prompts validated successfully');
    }
    
    // Check token limits
    const tokenLimits = aiConfig.getTokenLimits();
    console.log('\n📊 Token Limits:');
    console.log(`  Max Context: ${tokenLimits.max_context}`);
    console.log(`  Max Total: ${tokenLimits.max_total}`);
    
    // Check feature flags
    console.log('\n🚩 Feature Flags:');
    Object.entries(config.features).forEach(([feature, enabled]) => {
      console.log(`  ${enabled ? '✅' : '❌'} ${feature}`);
    });
    
    console.log('\n✅ Configuration validation completed');
    
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    process.exit(1);
  }
}

async function testConfig() {
  console.log('🧪 Testing AI configuration...\n');
  
  try {
    const config = aiConfig.loadConfig('development');
    
    // Test prompt template processing
    const sampleContext = {
      userQuery: 'How do I create a project charter?',
      sopList: [
        {
          sopId: 'SOP-001',
          title: 'Project Initiation',
          phase: 1,
          summary: 'Guidelines for starting projects',
          keyActivities: ['Define scope', 'Identify stakeholders'],
          deliverables: ['Project Charter', 'Stakeholder Register'],
          keywords: ['charter', 'initiation', 'stakeholders']
        }
      ],
      flow: config.flow,
      multi_sop: config.multi_sop
    };
    
    console.log('Testing SOP Selection prompt...');
    const sopSelectionPrompt = config.prompts.sop_selection_user;
    const processedPrompt = TemplateEngine.process(sopSelectionPrompt, sampleContext);
    
    console.log(`✅ Processed prompt length: ${processedPrompt.length} characters`);
    console.log(`✅ Variables found: ${TemplateUtils.extractVariables(sopSelectionPrompt).join(', ')}`);
    
    // Test mode configurations
    console.log('\n🔧 Mode Configurations:');
    Object.entries(config.modes).forEach(([mode, cfg]) => {
      console.log(`  ${mode}:`);
      console.log(`    Model: ${cfg.model}`);
      console.log(`    Temperature: ${cfg.temperature}`);
      console.log(`    Max Tokens: ${cfg.max_tokens}`);
    });
    
    console.log('\n✅ Configuration test completed');
    
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    process.exit(1);
  }
}

async function exportConfig() {
  console.log('📤 Exporting AI configuration...\n');
  
  try {
    const config = aiConfig.loadConfig('development');
    const exportPath = path.resolve(process.cwd(), 'ai-config-export.json');
    
    fs.writeFileSync(exportPath, JSON.stringify(config, null, 2));
    console.log(`✅ Configuration exported to: ${exportPath}`);
    
  } catch (error) {
    console.error('❌ Configuration export failed:', error);
    process.exit(1);
  }
}

async function reloadConfig() {
  console.log('🔄 Reloading AI configuration...\n');
  
  try {
    const config = aiConfig.reloadConfig();
    console.log('✅ Configuration reloaded successfully');
    
    console.log('\n📊 Current Settings:');
    console.log(`  Multi-SOP enabled: ${config.multi_sop.enabled}`);
    console.log(`  Max SOPs per query: ${config.multi_sop.max_sops_per_query}`);
    console.log(`  Confidence threshold: ${config.flow.confidence_threshold}`);
    
  } catch (error) {
    console.error('❌ Configuration reload failed:', error);
    process.exit(1);
  }
}

async function previewPrompts() {
  console.log('👁️  Previewing AI prompts...\n');
  
  try {
    const config = aiConfig.loadConfig('development');
    
    const sampleData = {
      userQuery: 'How do I manage project risks during the planning phase?',
      sopList: [
        {
          sopId: 'SOP-003',
          title: 'Design & Planning',
          phase: 3,
          summary: 'Detailed project planning procedures',
          keyActivities: ['Create work breakdown', 'Develop timeline', 'Risk assessment'],
          deliverables: ['Project Plan', 'Risk Register'],
          keywords: ['planning', 'risk', 'schedule']
        },
        {
          sopId: 'SOP-004',
          title: 'Risk Management',
          phase: 4,
          summary: 'Risk identification and mitigation strategies',
          keyActivities: ['Identify risks', 'Assess impact', 'Create mitigation plans'],
          deliverables: ['Risk Register', 'Mitigation Plans'],
          keywords: ['risk', 'assessment', 'mitigation']
        }
      ],
      flow: config.flow,
      multi_sop: config.multi_sop
    };
    
    console.log('=== SOP Selection Prompt Preview ===');
    const selectionPrompt = TemplateEngine.process(config.prompts.sop_selection_user, sampleData);
    console.log(selectionPrompt.substring(0, 500) + '...\n');
    
    console.log('=== General Knowledge Prompt Preview ===');
    const generalPrompt = TemplateEngine.process(config.prompts.general_knowledge_user, {
      userQuery: sampleData.userQuery,
      conversationHistory: 'User: What is Agile methodology?\nAssistant: Agile is an iterative approach...',
      hasConversationHistory: true
    });
    console.log(generalPrompt.substring(0, 500) + '...\n');
    
    console.log('✅ Prompt preview completed');
    
  } catch (error) {
    console.error('❌ Prompt preview failed:', error);
    process.exit(1);
  }
}

async function showHelp() {
  console.log(`
🤖 AI Configuration Manager

Available commands:
  validate  - Validate configuration file and prompts
  test      - Test configuration with sample data
  export    - Export configuration to JSON file
  reload    - Force reload configuration (dev only)
  preview   - Preview prompts with sample data
  help      - Show this help message

Usage:
  npm run ai-config <command>
  
Examples:
  npm run ai-config validate
  npm run ai-config test
  npm run ai-config preview
`);
}

// Main execution
async function main() {
  switch (command) {
    case 'validate':
      await validateConfig();
      break;
    case 'test':
      await testConfig();
      break;
    case 'export':
      await exportConfig();
      break;
    case 'reload':
      await reloadConfig();
      break;
    case 'preview':
      await previewPrompts();
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      await showHelp();
      break;
  }
}

main().catch(error => {
  console.error('❌ Command failed:', error);
  process.exit(1);
});