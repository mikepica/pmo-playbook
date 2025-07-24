import { ISection } from '@/models/AgentSOP';

interface ParsedSOP {
  title: string;
  phase: number;
  summary: string;
  description: string;
  sections: ISection;
  keywords: string[];
}

interface MarkdownSection {
  title: string;
  level: number;
  content: string;
  subsections: MarkdownSection[];
}

export function parseSOPMarkdown(markdown: string, sopId: string): ParsedSOP {
  // Extract title from first H1
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled SOP';
  
  // Extract phase number from SOP ID (e.g., SOP-001 -> 1)
  const phase = parseInt(sopId.replace('SOP-', '').charAt(0)) || 1;
  
  // Parse markdown into sections
  const sections = parseMarkdownSections(markdown);
  
  // Extract structured data from sections
  const structuredData = extractStructuredData(sections);
  
  // Generate summary from first paragraph or overview section
  const summary = extractSummary(sections, markdown);
  
  // Generate description from content
  const description = extractDescription(sections, markdown);
  
  // Extract keywords from content
  const keywords = extractKeywords(markdown, title);
  
  return {
    title,
    phase,
    summary,
    description,
    sections: structuredData,
    keywords
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

function extractStructuredData(sections: MarkdownSection[]): ISection {
  const result: ISection = {
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
    'Guidelines and procedures for this phase of project management.';
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
  
  // Add phase keywords
  const phaseKeywords = [
    'project management', 'pmo', 'methodology', 'process', 'framework',
    'governance', 'lifecycle', 'planning', 'execution', 'monitoring'
  ];
  
  phaseKeywords.forEach(kw => keywords.add(kw));
  
  // Extract from title
  title.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 4 && !['phase', 'the', 'and', 'for'].includes(word)) {
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

// Validation function to ensure SOP has required sections
export function validateSOPStructure(parsedSOP: ParsedSOP): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!parsedSOP.title || parsedSOP.title === 'Untitled SOP') {
    errors.push('SOP must have a title (H1 header)');
  }
  
  if (!parsedSOP.summary || parsedSOP.summary.length < 50) {
    errors.push('SOP must have a meaningful summary or overview section');
  }
  
  // Required sections
  if (parsedSOP.sections.objectives.length === 0) {
    errors.push('SOP must include objectives or goals');
  }
  
  if (parsedSOP.sections.keyActivities.length === 0) {
    errors.push('SOP must include key activities or tasks');
  }
  
  if (parsedSOP.sections.deliverables.length === 0) {
    warnings.push('SOP should include deliverables or outputs');
  }
  
  // Warnings for recommended sections
  if (parsedSOP.sections.rolesResponsibilities.length === 0) {
    warnings.push('Consider adding roles and responsibilities section');
  }
  
  if (parsedSOP.sections.toolsTemplates.length === 0) {
    warnings.push('Consider adding tools and templates section');
  }
  
  if (parsedSOP.sections.bestPractices.length === 0) {
    warnings.push('Consider adding best practices section');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}