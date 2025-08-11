import { AgentSOPSection } from '@/models/AgentSOP';
import { 
  detectSOPFormat, 
  matchesSemanticKeywords, 
  findSemanticMatches, 
  SEMANTIC_KEYWORDS 
} from './sop-detector';

interface ParsedSOP {
  title: string;
  summary: string;
  description: string;
  sections: AgentSOPSection;
  keywords: string[];
  parsingMetadata?: {
    detectedFormat: string;
    confidence: number;
    extractionStrategies: string[];
    qualityScore: number;
  };
}

interface MarkdownSection {
  title: string;
  level: number;
  content: string;
  subsections: MarkdownSection[];
}

export function parseSOPMarkdown(markdown: string, sopId: string, providedTitle?: string): ParsedSOP {
  // Detect format and analyze structure
  const formatDetection = detectSOPFormat(markdown);
  
  // Use provided title first, then try to extract from H1, then default
  let title = 'Untitled SOP';
  
  if (providedTitle && providedTitle.trim()) {
    title = providedTitle.trim();
  } else {
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
  }
  
  // Parse markdown into sections
  const sections = parseMarkdownSections(markdown);
  
  // Apply multiple extraction strategies based on detected format
  const extractionStrategies: string[] = [];
  const structuredData = extractWithIntelligentStrategies(sections, markdown, formatDetection, extractionStrategies);
  
  // Generate summary from first paragraph or overview section
  const summary = extractSummary(sections, markdown);
  
  // Generate description from content
  const description = extractDescription(sections, markdown);
  
  // Extract keywords from content
  const keywords = extractKeywords(markdown, title);
  
  // Calculate quality score
  const qualityScore = calculateQualityScore(structuredData, formatDetection);
  
  return {
    title,
    summary,
    description,
    sections: structuredData,
    keywords,
    parsingMetadata: {
      detectedFormat: formatDetection.detectedFormat,
      confidence: formatDetection.confidence,
      extractionStrategies,
      qualityScore
    }
  };
}

function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split('\n');
  const sections: MarkdownSection[] = [];
  const stack: { section: MarkdownSection; level: number }[] = [];
  
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headerMatch) {
      // Save previous content
      if (stack.length > 0 && currentContent.length > 0) {
        stack[stack.length - 1].section.content = currentContent.join('\n').trim();
      }
      currentContent = [];
      
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();
      
      const newSection: MarkdownSection = {
        title,
        level,
        content: '',
        subsections: []
      };
      
      // Pop stack until we find parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      
      // Add to parent or root
      if (stack.length > 0) {
        stack[stack.length - 1].section.subsections.push(newSection);
      } else {
        sections.push(newSection);
      }
      
      // Push to stack
      stack.push({ section: newSection, level });
    } else {
      currentContent.push(line);
    }
  }
  
  // Save final content
  if (stack.length > 0 && currentContent.length > 0) {
    stack[stack.length - 1].section.content = currentContent.join('\n').trim();
  }
  
  return sections;
}

function extractStructuredData(sections: MarkdownSection[]): AgentSOPSection {
  const result: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };
  
  // Helper function to extract list items from content
  const extractListItems = (content: string): string[] => {
    const items: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^[-*]\s+(.+)$/);
      if (match) {
        items.push(match[1].trim());
      }
    }
    
    return items;
  };
  
  // Helper function to search sections recursively
  const searchSections = (
    sections: MarkdownSection[], 
    patterns: RegExp[], 
    extractor: (section: MarkdownSection) => string[]
  ): string[] => {
    const results: string[] = [];
    
    for (const section of sections) {
      const titleLower = section.title.toLowerCase();
      
      if (patterns.some(pattern => pattern.test(titleLower))) {
        results.push(...extractor(section));
      }
      
      // Search subsections
      if (section.subsections.length > 0) {
        results.push(...searchSections(section.subsections, patterns, extractor));
      }
    }
    
    return results;
  };
  
  // Extract objectives
  result.objectives = searchSections(
    sections,
    [/objective/i, /goal/i, /purpose/i, /outcome/i],
    (section) => {
      const items = extractListItems(section.content);
      if (items.length > 0) return items;
      
      // If no list items, extract from paragraph
      const paragraphs = section.content.split('\n\n').filter(p => p.trim());
      return paragraphs.slice(0, 3); // Take first 3 paragraphs as objectives
    }
  );
  
  // Extract key activities
  result.keyActivities = searchSections(
    sections,
    [/activities/i, /tasks/i, /steps/i, /process/i, /actions/i],
    (section) => extractListItems(section.content)
  );
  
  // Extract deliverables
  result.deliverables = searchSections(
    sections,
    [/deliverable/i, /output/i, /artifact/i, /result/i, /product/i],
    (section) => extractListItems(section.content)
  );
  
  // Extract tools and templates
  result.toolsTemplates = searchSections(
    sections,
    [/tool/i, /template/i, /resource/i, /framework/i, /technique/i],
    (section) => extractListItems(section.content)
  );
  
  // Extract best practices
  result.bestPractices = searchSections(
    sections,
    [/best practice/i, /tip/i, /recommendation/i, /guidance/i],
    (section) => extractListItems(section.content)
  );
  
  // Extract common pitfalls
  result.commonPitfalls = searchSections(
    sections,
    [/pitfall/i, /mistake/i, /avoid/i, /warning/i, /caution/i, /risk/i],
    (section) => extractListItems(section.content)
  );
  
  // Extract roles and responsibilities
  const rolesSection = sections.find(s => 
    /role|responsibilit|stakeholder/i.test(s.title)
  );
  
  if (rolesSection) {
    result.rolesResponsibilities = extractRolesAndResponsibilities(rolesSection);
  }
  
  // If we didn't find enough data, do a more general extraction
  if (result.keyActivities.length === 0) {
    result.keyActivities = extractGeneralActivities(sections);
  }
  
  return result;
}

function extractRolesAndResponsibilities(section: MarkdownSection): { role: string; responsibilities: string[] }[] {
  const roles: { role: string; responsibilities: string[] }[] = [];
  const lines = section.content.split('\n');
  
  let currentRole: string | null = null;
  let currentResponsibilities: string[] = [];
  
  for (const line of lines) {
    // Check for role header (e.g., "**Project Manager:**" or "### Project Manager")
    const roleMatch = line.match(/^(?:\*\*|###?\s*)([^:*#]+)(?:\*\*|:)?/);
    
    if (roleMatch && line.trim().length > 0) {
      // Save previous role if exists
      if (currentRole && currentResponsibilities.length > 0) {
        roles.push({
          role: currentRole,
          responsibilities: currentResponsibilities
        });
      }
      
      currentRole = roleMatch[1].trim();
      currentResponsibilities = [];
    } else {
      // Check for responsibility list item
      const itemMatch = line.match(/^[-*]\s+(.+)$/);
      if (itemMatch && currentRole) {
        currentResponsibilities.push(itemMatch[1].trim());
      }
    }
  }
  
  // Save last role
  if (currentRole && currentResponsibilities.length > 0) {
    roles.push({
      role: currentRole,
      responsibilities: currentResponsibilities
    });
  }
  
  return roles;
}

function extractGeneralActivities(sections: MarkdownSection[]): string[] {
  const activities: string[] = [];
  
  // Look for any section with lists
  for (const section of sections) {
    if (section.content.includes('- ') || section.content.includes('* ')) {
      const items = section.content.split('\n')
        .filter(line => line.match(/^[-*]\s+/))
        .map(line => line.replace(/^[-*]\s+/, '').trim())
        .filter(item => item.length > 20); // Filter out very short items
      
      activities.push(...items);
    }
    
    // Recursively check subsections
    if (section.subsections.length > 0) {
      activities.push(...extractGeneralActivities(section.subsections));
    }
  }
  
  return activities.slice(0, 10); // Limit to 10 activities
}

function extractSummary(sections: MarkdownSection[], markdown: string): string {
  // Look for overview or summary section
  const summarySection = sections.find(s => 
    /overview|summary|introduction|purpose/i.test(s.title)
  );
  
  if (summarySection && summarySection.content) {
    const firstParagraph = summarySection.content.split('\n\n')[0].trim();
    if (firstParagraph) {
      return firstParagraph.substring(0, 500);
    }
  }
  
  // Extract first meaningful paragraph after title
  const lines = markdown.split('\n');
  let foundTitle = false;
  let paragraph = '';
  
  for (const line of lines) {
    if (line.match(/^#\s+/)) {
      foundTitle = true;
      continue;
    }
    
    if (foundTitle && line.trim() && !line.match(/^#/)) {
      paragraph += line + ' ';
      
      if (paragraph.length > 100) {
        break;
      }
    }
  }
  
  return paragraph.trim().substring(0, 500) || 
    'Guidelines and procedures for project management operations.';
}

function extractDescription(sections: MarkdownSection[], markdown: string): string {
  // Combine overview and first few sections for description
  const descriptionParts: string[] = [];
  
  // Add summary
  const summary = extractSummary(sections, markdown);
  if (summary) {
    descriptionParts.push(summary);
  }
  
  // Add key sections
  for (const section of sections.slice(0, 3)) {
    if (section.content) {
      const firstParagraph = section.content.split('\n\n')[0].trim();
      if (firstParagraph && firstParagraph.length > 50) {
        descriptionParts.push(`${section.title}: ${firstParagraph.substring(0, 200)}...`);
      }
    }
  }
  
  return descriptionParts.join('\n\n').substring(0, 1000);
}

function extractKeywords(markdown: string, title: string): string[] {
  const keywords = new Set<string>();
  
  // Add general PMO keywords
  const generalKeywords = [
    'project management', 'pmo', 'methodology', 'process', 'framework',
    'governance', 'lifecycle', 'planning', 'execution', 'monitoring'
  ];
  
  generalKeywords.forEach(kw => keywords.add(kw));
  
  // Extract from title
  title.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 4 && !['the', 'and', 'for'].includes(word)) {
      keywords.add(word);
    }
  });
  
  // Extract section headers
  const headers = markdown.match(/^#{1,3}\s+(.+)$/gm) || [];
  headers.forEach(header => {
    const words = header.replace(/^#+\s+/, '').toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 4 && !['the', 'and', 'for', 'with'].includes(word)) {
        keywords.add(word.replace(/[^a-z]/g, ''));
      }
    });
  });
  
  // Extract important terms from content
  const importantTerms = markdown.match(/\*\*([^*]+)\*\*/g) || [];
  importantTerms.forEach(term => {
    const cleaned = term.replace(/\*\*/g, '').toLowerCase().trim();
    if (cleaned.length > 3 && cleaned.length < 30) {
      keywords.add(cleaned);
    }
  });
  
  return Array.from(keywords).slice(0, 20); // Limit to 20 keywords
}

// Intelligent extraction strategies that combine multiple approaches
function extractWithIntelligentStrategies(
  sections: MarkdownSection[], 
  fullMarkdown: string,
  formatDetection: any,
  extractionStrategies: string[]
): AgentSOPSection {
  const result: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };

  // Strategy 1: Original header-based extraction (for compatibility)
  extractionStrategies.push('header_based');
  const headerBasedResult = extractStructuredData(sections);
  mergeResults(result, headerBasedResult);

  // Strategy 2: Semantic similarity extraction
  extractionStrategies.push('semantic_similarity');
  const semanticResult = extractBySemantic(sections, fullMarkdown);
  mergeResults(result, semanticResult);

  // Strategy 3: Pattern-based extraction for specific formats
  if (formatDetection.detectedFormat !== 'generic') {
    extractionStrategies.push(`format_specific_${formatDetection.detectedFormat}`);
    const formatSpecificResult = extractByFormat(sections, fullMarkdown, formatDetection.detectedFormat);
    mergeResults(result, formatSpecificResult);
  }

  // Strategy 4: Context-aware extraction (infer missing content)
  extractionStrategies.push('context_inference');
  const inferredResult = inferMissingContent(result, sections, fullMarkdown);
  mergeResults(result, inferredResult);

  // Strategy 5: Cleanup and deduplication
  extractionStrategies.push('cleanup_dedup');
  deduplicateAndCleanup(result);

  return result;
}

// Extract content using semantic similarity
function extractBySemantic(sections: MarkdownSection[], fullMarkdown: string): AgentSOPSection {
  const result: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };

  // Convert sections to simple format for semantic matching
  const simpleSections = sections.map(s => ({title: s.title, content: s.content}));

  // Find semantic matches for each field
  const objectiveMatches = findSemanticMatches(simpleSections, 'objectives', 0.2);
  const activityMatches = findSemanticMatches(simpleSections, 'activities', 0.2);
  const deliverableMatches = findSemanticMatches(simpleSections, 'deliverables', 0.2);
  const roleMatches = findSemanticMatches(simpleSections, 'roles', 0.2);
  const toolMatches = findSemanticMatches(simpleSections, 'tools', 0.2);
  const practiceMatches = findSemanticMatches(simpleSections, 'practices', 0.2);
  const pitfallMatches = findSemanticMatches(simpleSections, 'pitfalls', 0.2);

  // Extract content from matches
  result.objectives.push(...extractContentFromMatches(objectiveMatches));
  result.keyActivities.push(...extractContentFromMatches(activityMatches));
  result.deliverables.push(...extractContentFromMatches(deliverableMatches));
  result.toolsTemplates.push(...extractContentFromMatches(toolMatches));
  result.bestPractices?.push(...extractContentFromMatches(practiceMatches));
  result.commonPitfalls?.push(...extractContentFromMatches(pitfallMatches));

  // Extract roles with responsibilities
  result.rolesResponsibilities.push(...extractRolesFromMatches(roleMatches));

  return result;
}

// Extract content based on specific format patterns
function extractByFormat(sections: MarkdownSection[], fullMarkdown: string, format: string): AgentSOPSection {
  const result: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };

  switch (format) {
    case 'technical':
      return extractTechnicalFormat(sections, fullMarkdown);
    
    case 'decision-tree':
      return extractDecisionTreeFormat(sections, fullMarkdown);
    
    case 'process':
      return extractProcessFormat(sections, fullMarkdown);
    
    case 'checklist':
      return extractChecklistFormat(sections, fullMarkdown);
    
    case 'narrative':
      return extractNarrativeFormat(sections, fullMarkdown);
    
    default:
      return result;
  }
}

// Technical format extraction
function extractTechnicalFormat(sections: MarkdownSection[], fullMarkdown: string): AgentSOPSection {
  const result: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };

  // Technical-specific mappings
  const technicalMappings = {
    prerequisites: 'toolsTemplates',
    symptoms: 'commonPitfalls', 
    'diagnostic steps': 'keyActivities',
    'resolution procedures': 'keyActivities',
    troubleshooting: 'keyActivities',
    'error handling': 'commonPitfalls',
    recommendations: 'bestPractices'
  };

  for (const section of sections) {
    const titleLower = section.title.toLowerCase();
    
    for (const [pattern, field] of Object.entries(technicalMappings)) {
      if (titleLower.includes(pattern)) {
        const items = extractListItems(section.content);
        if (items.length > 0) {
          (result as any)[field].push(...items);
        }
      }
    }
  }

  return result;
}

// Decision tree format extraction
function extractDecisionTreeFormat(sections: MarkdownSection[], fullMarkdown: string): AgentSOPSection {
  const result: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };

  // Extract decision points and actions
  const decisionPattern = /(?:if|when)\s+.*?(?:then|:)/gi;
  const actionPattern = /action:\s*(.+)/gi;
  const documentPattern = /document:\s*(.+)/gi;

  let match;
  while ((match = actionPattern.exec(fullMarkdown)) !== null) {
    result.keyActivities.push(match[1].trim());
  }

  while ((match = documentPattern.exec(fullMarkdown)) !== null) {
    result.deliverables.push(match[1].trim());
  }

  return result;
}

// Process format extraction
function extractProcessFormat(sections: MarkdownSection[], fullMarkdown: string): AgentSOPSection {
  const result: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };

  // Extract numbered steps as activities
  const numberedSteps = fullMarkdown.match(/^\d+\.\s+(.+)$/gm) || [];
  result.keyActivities.push(...numberedSteps.map(step => step.replace(/^\d+\.\s+/, '')));

  return result;
}

// Checklist format extraction
function extractChecklistFormat(sections: MarkdownSection[], fullMarkdown: string): AgentSOPSection {
  const result: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };

  // Extract checklist items as activities
  const checklistItems = fullMarkdown.match(/[-*]\s*\[[\s\u2713\u2717\u2612\u2610x]\]\s*(.+)/gi) || [];
  result.keyActivities.push(...checklistItems.map(item => 
    item.replace(/[-*]\s*\[[\s\u2713\u2717\u2612\u2610x]\]\s*/, '').trim()
  ));

  return result;
}

// Narrative format extraction
function extractNarrativeFormat(sections: MarkdownSection[], fullMarkdown: string): AgentSOPSection {
  const result: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };

  // Extract actions from narrative text
  const actionPattern = /(?:must|should|will|need to|have to)\s+([^.!?]+)/gi;
  let match;
  while ((match = actionPattern.exec(fullMarkdown)) !== null) {
    const action = match[1].trim();
    if (action.length > 10 && action.length < 150) {
      result.keyActivities.push(action);
    }
  }

  return result;
}

// Infer missing content from existing content - enhanced for minimal SOPs
function inferMissingContent(
  currentResult: AgentSOPSection, 
  sections: MarkdownSection[], 
  fullMarkdown: string
): AgentSOPSection {
  const inferred: AgentSOPSection = {
    objectives: [],
    keyActivities: [],
    deliverables: [],
    rolesResponsibilities: [],
    toolsTemplates: [],
    bestPractices: [],
    commonPitfalls: []
  };

  // Get basic info
  const title = fullMarkdown.match(/^#\s+(.+)$/m)?.[1] || '';
  const contentWithoutTitle = fullMarkdown.replace(/^#\s+.+$/m, '').trim();
  const allText = fullMarkdown.toLowerCase();
  
  // Infer objectives if missing - be more aggressive
  if (currentResult.objectives.length === 0) {
    if (title) {
      inferred.objectives.push(`Complete the ${title.toLowerCase().replace(/sop|process|procedure/i, '').trim()} process effectively`);
    }
    
    // Look for goal-like statements in any paragraph
    const paragraphs = contentWithoutTitle.split('\n\n').filter(p => p.trim());
    for (const paragraph of paragraphs.slice(0, 2)) {
      if (paragraph && paragraph.length > 15) {
        // Extract first sentence as potential objective
        const firstSentence = paragraph.split(/[.!?]/)[0].trim();
        if (firstSentence.length > 10 && firstSentence.length < 200) {
          inferred.objectives.push(firstSentence + (firstSentence.endsWith('.') ? '' : '.'));
        }
      }
    }
    
    // Default objective if still nothing
    if (inferred.objectives.length === 0) {
      inferred.objectives.push(title ? `Execute ${title.toLowerCase()} successfully` : 'Complete the process successfully');
    }
  }

  // Infer activities from any content - be more aggressive
  if (currentResult.keyActivities.length === 0) {
    // Look for action verbs in content
    const actionPattern = /(?:need to|should|must|will|have to|ensure|make sure|verify|check|create|update|review|complete|submit|approve|analyze|implement|execute|perform|conduct|manage)\s+([^.!?\n]{10,100})/gi;
    let match;
    const activities: string[] = [];
    
    while ((match = actionPattern.exec(fullMarkdown)) !== null) {
      const activity = match[0].trim();
      if (activity.length > 15 && activity.length < 150 && !activities.includes(activity)) {
        activities.push(activity);
      }
    }
    
    // Add activities from action verbs
    inferred.keyActivities.push(...activities.slice(0, 5));
    
    // Look for any sentences that seem like steps
    const sentences = contentWithoutTitle.split(/[.!?]/).filter(s => s.trim().length > 10);
    for (const sentence of sentences.slice(0, 3)) {
      if (sentence.length > 15 && sentence.length < 150) {
        const cleaned = sentence.trim();
        if (cleaned && !inferred.keyActivities.some(act => act.includes(cleaned.substring(0, 20)))) {
          inferred.keyActivities.push(cleaned);
        }
      }
    }
    
    // Default activity if still nothing
    if (inferred.keyActivities.length === 0) {
      if (title) {
        inferred.keyActivities.push(`Perform ${title.toLowerCase().replace(/sop|process|procedure/i, '').trim()} tasks`);
      } else {
        inferred.keyActivities.push('Execute the required tasks');
      }
    }
  }

  // Infer deliverables - be more creative
  if (currentResult.deliverables.length === 0) {
    // Look for deliverable words in context
    const deliverableWords = ['report', 'document', 'record', 'file', 'output', 'result', 'summary', 'analysis', 'review', 'plan', 'proposal', 'recommendation'];
    const found: string[] = [];
    
    for (const word of deliverableWords) {
      if (allText.includes(word) && !found.includes(word)) {
        found.push(`${word.charAt(0).toUpperCase() + word.slice(1)}`);
      }
    }
    
    inferred.deliverables.push(...found);
    
    // Look for "create", "produce", "generate" patterns
    const createPattern = /(?:create|produce|generate|prepare|develop|build|make)\s+(?:a|an|the)?\s*([^.!?\n]{5,50})/gi;
    let createMatch;
    while ((createMatch = createPattern.exec(fullMarkdown)) !== null) {
      const deliverable = createMatch[1].trim();
      if (deliverable.length > 3 && deliverable.length < 50) {
        inferred.deliverables.push(deliverable.charAt(0).toUpperCase() + deliverable.slice(1));
      }
    }
    
    // Default deliverables
    if (inferred.deliverables.length === 0) {
      if (title && (title.includes('report') || title.includes('analysis') || title.includes('review'))) {
        inferred.deliverables.push(`${title} document`);
      } else {
        inferred.deliverables.push('Process completion record', 'Status update');
      }
    }
  }

  // Infer roles from any mentions of people/roles
  if (currentResult.rolesResponsibilities.length === 0) {
    const rolePattern = /\b(manager|lead|team|member|analyst|coordinator|specialist|admin|user|client|customer|stakeholder|owner|responsible|accountable)\b/gi;
    const roles: string[] = [];
    let match;
    
    while ((match = rolePattern.exec(fullMarkdown)) !== null) {
      const role = match[1].toLowerCase();
      if (!roles.includes(role)) {
        roles.push(role);
      }
    }
    
    // Create basic role assignments
    for (const role of roles.slice(0, 3)) {
      const roleName = role.charAt(0).toUpperCase() + role.slice(1);
      inferred.rolesResponsibilities.push({
        role: roleName,
        responsibilities: [`Handle ${roleName.toLowerCase()} tasks for this process`]
      });
    }
    
    // Default role if nothing found
    if (inferred.rolesResponsibilities.length === 0) {
      inferred.rolesResponsibilities.push({
        role: 'Process Owner',
        responsibilities: ['Execute the process', 'Ensure completion', 'Document results']
      });
    }
  }

  return inferred;
}

// Helper functions
function extractContentFromMatches(matches: Array<{section: any; score: number}>): string[] {
  const content: string[] = [];
  
  for (const match of matches) {
    const items = extractListItems(match.section.content);
    if (items.length > 0) {
      content.push(...items);
    } else {
      // Extract from paragraph text
      const paragraphs = match.section.content.split('\n\n').filter((p: string) => p.trim());
      for (const paragraph of paragraphs.slice(0, 2)) { // Max 2 paragraphs
        if (paragraph.length > 20 && paragraph.length < 300) {
          content.push(paragraph.trim());
        }
      }
    }
  }
  
  return content;
}

function extractRolesFromMatches(matches: Array<{section: any; score: number}>): Array<{role: string; responsibilities: string[]}> {
  const roles: Array<{role: string; responsibilities: string[]}> = [];
  
  for (const match of matches) {
    const extractedRoles = extractRolesAndResponsibilities(match.section);
    roles.push(...extractedRoles);
  }
  
  return roles;
}

function extractListItems(content: string): string[] {
  const items: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^[-*+]\s+(.+)$/);
    if (match) {
      items.push(match[1].trim());
    }
  }
  
  return items;
}

function mergeResults(target: AgentSOPSection, source: AgentSOPSection) {
  target.objectives.push(...source.objectives);
  target.keyActivities.push(...source.keyActivities);
  target.deliverables.push(...source.deliverables);
  target.rolesResponsibilities.push(...source.rolesResponsibilities);
  target.toolsTemplates.push(...source.toolsTemplates);
  target.bestPractices?.push(...(source.bestPractices || []));
  target.commonPitfalls?.push(...(source.commonPitfalls || []));
}

function deduplicateAndCleanup(result: AgentSOPSection) {
  // Remove duplicates and clean up each field
  result.objectives = [...new Set(result.objectives)].filter(item => item.trim().length > 10);
  result.keyActivities = [...new Set(result.keyActivities)].filter(item => item.trim().length > 10);
  result.deliverables = [...new Set(result.deliverables)].filter(item => item.trim().length > 5);
  result.toolsTemplates = [...new Set(result.toolsTemplates)].filter(item => item.trim().length > 3);
  result.bestPractices = [...new Set(result.bestPractices || [])].filter(item => item.trim().length > 10);
  result.commonPitfalls = [...new Set(result.commonPitfalls || [])].filter(item => item.trim().length > 10);
  
  // Remove duplicate roles
  const uniqueRoles = new Map();
  for (const roleResp of result.rolesResponsibilities) {
    if (!uniqueRoles.has(roleResp.role)) {
      uniqueRoles.set(roleResp.role, roleResp);
    } else {
      // Merge responsibilities
      const existing = uniqueRoles.get(roleResp.role);
      existing.responsibilities = [...new Set([...existing.responsibilities, ...roleResp.responsibilities])];
    }
  }
  result.rolesResponsibilities = Array.from(uniqueRoles.values());
}

function calculateQualityScore(sections: AgentSOPSection, formatDetection: any): number {
  let score = 0;
  let maxScore = 0;
  
  // More generous scoring - give higher baseline scores
  const weights = {
    objectives: 0.2,
    keyActivities: 0.3,
    deliverables: 0.2,
    rolesResponsibilities: 0.1,
    toolsTemplates: 0.1,
    bestPractices: 0.05,
    commonPitfalls: 0.05
  };
  
  for (const [field, weight] of Object.entries(weights)) {
    maxScore += weight;
    const fieldData = (sections as any)[field];
    
    if (Array.isArray(fieldData) && fieldData.length > 0) {
      // More generous base score for having any content
      let fieldScore = weight * 0.8; // Increased from 0.5
      
      // Bonus for having multiple items
      if (fieldData.length > 1) {
        fieldScore += weight * 0.15; // Slightly reduced but still bonus
      }
      
      // More generous length requirement
      const avgLength = fieldData.reduce((sum: number, item: any) => {
        const text = typeof item === 'string' ? item : JSON.stringify(item);
        return sum + text.length;
      }, 0) / fieldData.length;
      
      if (avgLength > 20) { // Reduced from 50
        fieldScore += weight * 0.05; // Small bonus for decent length
      }
      
      score += fieldScore;
    } else {
      // Give some credit even for empty fields (they might be inferred)
      score += weight * 0.1;
    }
  }
  
  // Base score bonus to ensure minimum viable score
  score += 0.2; // 20% base score for any content
  
  // Bonus for format detection confidence
  score += formatDetection.confidence * 0.1;
  
  return Math.min(100, (score / maxScore) * 100);
}

// Enhanced validation using quality scoring instead of strict requirements
export function validateSOPStructure(parsedSOP: ParsedSOP): {
  isValid: boolean;
  qualityScore: number;
  suggestions: string[];
  warnings: string[];
  strengths: string[];
} {
  const suggestions: string[] = [];
  const warnings: string[] = [];
  const strengths: string[] = [];
  
  // Get quality score from metadata (if available) or calculate it
  const qualityScore = parsedSOP.parsingMetadata?.qualityScore || 50;
  
  // Title validation - now a suggestion instead of error
  if (!parsedSOP.title || parsedSOP.title === 'Untitled SOP') {
    suggestions.push('Add a descriptive title using H1 header (# Title)');
  } else {
    strengths.push('Has clear title');
  }
  
  // Summary validation - now flexible
  if (!parsedSOP.summary || parsedSOP.summary.length < 20) {
    suggestions.push('Add an overview or summary section to explain the SOP\'s purpose');
  } else if (parsedSOP.summary.length > 50) {
    strengths.push('Has comprehensive summary');
  }
  
  // Content sections validation - flexible approach
  const sectionAnalysis = analyzeSectionContent(parsedSOP.sections);
  
  if (sectionAnalysis.objectives.count === 0) {
    suggestions.push('Consider adding clear objectives or goals for this process');
  } else {
    strengths.push(`Has ${sectionAnalysis.objectives.count} objective(s)`);
  }
  
  if (sectionAnalysis.activities.count === 0) {
    suggestions.push('Add key activities, tasks, or steps for this process');
  } else {
    strengths.push(`Has ${sectionAnalysis.activities.count} key activit${sectionAnalysis.activities.count === 1 ? 'y' : 'ies'}`);
  }
  
  if (sectionAnalysis.deliverables.count === 0) {
    suggestions.push('Consider specifying deliverables or outputs from this process');
  } else {
    strengths.push(`Defines ${sectionAnalysis.deliverables.count} deliverable(s)`);
  }
  
  // Optional sections - suggestions only
  if (sectionAnalysis.roles.count === 0) {
    suggestions.push('Consider adding roles and responsibilities for clarity');
  } else {
    strengths.push(`Defines ${sectionAnalysis.roles.count} role(s)`);
  }
  
  if (sectionAnalysis.tools.count === 0) {
    suggestions.push('Consider mentioning required tools, templates, or resources');
  } else {
    strengths.push(`Lists ${sectionAnalysis.tools.count} tool(s) or template(s)`);
  }
  
  if (sectionAnalysis.practices.count === 0) {
    suggestions.push('Consider adding best practices or tips for success');
  } else {
    strengths.push(`Includes ${sectionAnalysis.practices.count} best practice(s)`);
  }
  
  if (sectionAnalysis.pitfalls.count === 0) {
    suggestions.push('Consider mentioning common pitfalls or things to avoid');
  } else {
    strengths.push(`Highlights ${sectionAnalysis.pitfalls.count} common pitfall(s)`);
  }
  
  // Quality-based warnings
  if (qualityScore < 30) {
    warnings.push('Consider adding more detailed content to improve extraction quality');
  }
  
  if (parsedSOP.parsingMetadata?.confidence && parsedSOP.parsingMetadata.confidence < 0.3) {
    warnings.push('Format not clearly recognized - consider structuring content with headers and lists');
  }
  
  // Always valid now - we work with what we have
  const isValid = true;
  
  return {
    isValid,
    qualityScore,
    suggestions,
    warnings,
    strengths
  };
}

// Helper function to analyze section content
function analyzeSectionContent(sections: AgentSOPSection) {
  return {
    objectives: {
      count: sections.objectives.length,
      quality: sections.objectives.length > 0 ? 
        sections.objectives.reduce((sum, obj) => sum + obj.length, 0) / sections.objectives.length : 0
    },
    activities: {
      count: sections.keyActivities.length,
      quality: sections.keyActivities.length > 0 ? 
        sections.keyActivities.reduce((sum, act) => sum + act.length, 0) / sections.keyActivities.length : 0
    },
    deliverables: {
      count: sections.deliverables.length,
      quality: sections.deliverables.length > 0 ? 
        sections.deliverables.reduce((sum, del) => sum + del.length, 0) / sections.deliverables.length : 0
    },
    roles: {
      count: sections.rolesResponsibilities.length,
      quality: sections.rolesResponsibilities.length > 0 ? 
        sections.rolesResponsibilities.reduce((sum, role) => sum + role.responsibilities.length, 0) / sections.rolesResponsibilities.length : 0
    },
    tools: {
      count: sections.toolsTemplates.length,
      quality: sections.toolsTemplates.length > 0 ? 
        sections.toolsTemplates.reduce((sum, tool) => sum + tool.length, 0) / sections.toolsTemplates.length : 0
    },
    practices: {
      count: sections.bestPractices?.length || 0,
      quality: sections.bestPractices && sections.bestPractices.length > 0 ? 
        sections.bestPractices.reduce((sum, practice) => sum + practice.length, 0) / sections.bestPractices.length : 0
    },
    pitfalls: {
      count: sections.commonPitfalls?.length || 0,
      quality: sections.commonPitfalls && sections.commonPitfalls.length > 0 ? 
        sections.commonPitfalls.reduce((sum, pitfall) => sum + pitfall.length, 0) / sections.commonPitfalls.length : 0
    }
  };
}