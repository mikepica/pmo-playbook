import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { connectToDatabase } from '../src/lib/mongodb';
import HumanSOP from '../src/models/HumanSOP';
import AgentSOP from '../src/models/AgentSOP';

interface MarkdownStructure {
  title: string;
  phase: number;
  objective: string;
  keyActivities: string[];
  deliverables: string[];
  rolesResponsibilities: { role: string; responsibilities: string[] }[];
  toolsTemplates: string[];
  fullContent: string;
}

// File mapping with phase numbers
const SOPFiles = [
  { file: '01 Pre-Initiate.md', phase: 1, sopId: 'SOP-001' },
  { file: '02 Initiate-Phase.md', phase: 2, sopId: 'SOP-002' },
  { file: '03 Design-and-plan.md', phase: 3, sopId: 'SOP-003' },
  { file: '04 Implement-and-control.md', phase: 4, sopId: 'SOP-004' },
  { file: '05 close-realize-benefits.md', phase: 5, sopId: 'SOP-005' }
];

async function parseMarkdownFile(filePath: string): Promise<MarkdownStructure> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let title = '';
  let objective = '';
  const keyActivities: string[] = [];
  const deliverables: string[] = [];
  const rolesResponsibilities: { role: string; responsibilities: string[] }[] = [];
  const toolsTemplates: string[] = [];
  
  let currentSection = '';
  let inTable = false;
  let tableHeaders: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Extract title
    if (line.startsWith('# PMO SOP –') || line.startsWith('# PMO SOP -')) {
      title = line.replace(/^# PMO SOP [–-]\s*/, '').trim();
      continue;
    }
    
    // Identify sections
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').toLowerCase();
      inTable = false;
      continue;
    }
    
    // Handle table headers for roles and responsibilities
    if (line.includes('| Role | Responsibility |')) {
      inTable = true;
      tableHeaders = ['role', 'responsibility'];
      continue;
    }
    
    // Skip table separator
    if (line.includes('|------|')) {
      continue;
    }
    
    // Process content based on current section
    switch (currentSection) {
      case 'objective':
        if (line && !line.startsWith('##') && !line.startsWith('|')) {
          objective = line;
        }
        break;
        
      case 'key activities':
        if (line.startsWith('- ')) {
          keyActivities.push(line.replace('- ', ''));
        }
        break;
        
      case 'deliverables':
        if (line.startsWith('- ')) {
          deliverables.push(line.replace('- ', ''));
        }
        break;
        
      case 'roles and responsibilities':
        if (inTable && line.includes('|') && !line.includes('Role') && !line.includes('---')) {
          const parts = line.split('|').map(p => p.trim()).filter(p => p);
          if (parts.length >= 2) {
            const role = parts[0];
            const responsibility = parts[1];
            
            // Check if this role already exists
            const existingRole = rolesResponsibilities.find(r => r.role === role);
            if (existingRole) {
              existingRole.responsibilities.push(responsibility);
            } else {
              rolesResponsibilities.push({
                role,
                responsibilities: [responsibility]
              });
            }
          }
        }
        break;
        
      case 'tools & templates':
        if (line.startsWith('- ')) {
          toolsTemplates.push(line.replace('- ', ''));
        }
        break;
    }
  }
  
  // Extract phase number from filename
  const filename = path.basename(filePath);
  const phaseMatch = filename.match(/^(\d+)/);
  const phase = phaseMatch ? parseInt(phaseMatch[1]) : 1;
  
  return {
    title,
    phase,
    objective,
    keyActivities,
    deliverables,
    rolesResponsibilities,
    toolsTemplates,
    fullContent: content
  };
}

function generateSummary(parsed: MarkdownStructure): string {
  const activityCount = parsed.keyActivities.length;
  const deliverableCount = parsed.deliverables.length;
  
  return `Phase ${parsed.phase} covers ${parsed.objective.toLowerCase()}. ` +
         `Includes ${activityCount} key activities and produces ${deliverableCount} deliverables. ` +
         `Key focus areas: ${parsed.keyActivities.slice(0, 3).join(', ')}.`;
}

function extractKeywords(parsed: MarkdownStructure): string[] {
  const text = [
    parsed.title,
    parsed.objective,
    ...parsed.keyActivities,
    ...parsed.deliverables
  ].join(' ').toLowerCase();
  
  // Extract meaningful keywords (excluding common words)
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'shall', 'can', 'project', 'phase', 'pmo'];
  
  const words = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.includes(word))
    .filter((word, index, array) => array.indexOf(word) === index); // Remove duplicates
  
  return words.slice(0, 10); // Limit to 10 keywords
}

async function createHumanSOP(parsed: MarkdownStructure, sopId: string) {
  return await HumanSOP.create({
    sopId,
    title: parsed.title,
    phase: parsed.phase,
    markdownContent: parsed.fullContent,
    version: 1,
    createdBy: 'migration-script'
  });
}

async function createAgentSOP(parsed: MarkdownStructure, sopId: string, humanSopId: any) {
  const summary = generateSummary(parsed);
  const keywords = extractKeywords(parsed);
  
  return await AgentSOP.create({
    sopId,
    humanSopId,
    title: parsed.title,
    phase: parsed.phase,
    summary,
    description: parsed.objective,
    sections: {
      objectives: [parsed.objective],
      keyActivities: parsed.keyActivities,
      deliverables: parsed.deliverables,
      rolesResponsibilities: parsed.rolesResponsibilities,
      toolsTemplates: parsed.toolsTemplates
    },
    keywords,
    searchableContent: '' // Will be set by pre-save middleware
  });
}

async function migrateSOP(sopFile: typeof SOPFiles[0]) {
  const filePath = path.join(__dirname, '..', 'content', 'markdown', sopFile.file);
  
  console.log(`📄 Processing ${sopFile.file}...`);
  
  try {
    // Parse the markdown file
    const parsed = await parseMarkdownFile(filePath);
    console.log(`  - Title: ${parsed.title}`);
    console.log(`  - Phase: ${parsed.phase}`);
    console.log(`  - Activities: ${parsed.keyActivities.length}`);
    console.log(`  - Deliverables: ${parsed.deliverables.length}`);
    console.log(`  - Roles: ${parsed.rolesResponsibilities.length}`);
    
    // Create HumanSOP
    const humanSOP = await createHumanSOP(parsed, sopFile.sopId);
    console.log(`  ✅ HumanSOP created: ${humanSOP.sopId}`);
    
    // Create AgentSOP
    const agentSOP = await createAgentSOP(parsed, sopFile.sopId, humanSOP._id);
    console.log(`  ✅ AgentSOP created: ${agentSOP.sopId}`);
    console.log(`  - Keywords: ${agentSOP.keywords.slice(0, 5).join(', ')}`);
    
    return { humanSOP, agentSOP };
  } catch (error) {
    console.error(`  ❌ Error processing ${sopFile.file}:`, error);
    throw error;
  }
}

async function cleanupExisting() {
  console.log('🧹 Cleaning up existing SOPs...');
  
  const humanSOPs = await HumanSOP.deleteMany({
    sopId: { $in: SOPFiles.map(f => f.sopId) }
  });
  
  const agentSOPs = await AgentSOP.deleteMany({
    sopId: { $in: SOPFiles.map(f => f.sopId) }
  });
  
  console.log(`  - Deleted ${humanSOPs.deletedCount} HumanSOPs`);
  console.log(`  - Deleted ${agentSOPs.deletedCount} AgentSOPs`);
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');
  
  // Check HumanSOPs
  const humanSOPs = await HumanSOP.find({}).sort({ phase: 1 });
  console.log(`  - Found ${humanSOPs.length} HumanSOPs`);
  
  // Check AgentSOPs
  const agentSOPs = await AgentSOP.find({}).sort({ phase: 1 });
  console.log(`  - Found ${agentSOPs.length} AgentSOPs`);
  
  // Test search functionality
  const searchResults = await AgentSOP.findBestMatch('stakeholder analysis');
  console.log(`  - Search test returned ${searchResults.length} results`);
  
  // Get summaries for AI
  const summaries = await AgentSOP.getAllSummaries();
  console.log(`  - Retrieved ${summaries.length} summaries for AI`);
  
  // Display sample data
  if (agentSOPs.length > 0) {
    const sample = agentSOPs[0];
    console.log(`  - Sample SOP: ${sample.title}`);
    console.log(`  - Sample keywords: ${sample.keywords.slice(0, 3).join(', ')}`);
    console.log(`  - Searchable content length: ${sample.searchableContent?.length || 0} chars`);
  }
}

async function main() {
  try {
    console.log('🚀 Starting SOP Migration...\n');
    
    // Connect to database
    console.log('📡 Connecting to MongoDB...');
    await connectToDatabase();
    console.log('✅ Connected to MongoDB\n');
    
    // Clean up existing data
    await cleanupExisting();
    console.log('');
    
    // Migrate each SOP file
    const results = [];
    for (const sopFile of SOPFiles) {
      const result = await migrateSOP(sopFile);
      results.push(result);
      console.log('');
    }
    
    // Verify migration
    await verifyMigration();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log(`✅ Migrated ${results.length} SOPs to database`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
main();