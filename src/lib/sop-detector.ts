// Smart SOP Format Detector
// Automatically identifies SOP structure patterns and content types

export interface FormatDetectionResult {
  detectedFormat: string;
  confidence: number;
  patterns: string[];
  structure: StructureAnalysis;
}

export interface StructureAnalysis {
  hasNumberedLists: boolean;
  hasBulletLists: boolean;
  hasConditionalLogic: boolean;
  hasCodeBlocks: boolean;
  hasDecisionPoints: boolean;
  hasTechnicalTerms: boolean;
  hasRoleDefinitions: boolean;
  sectionCount: number;
  averageSectionLength: number;
}

export interface ContentPattern {
  name: string;
  patterns: RegExp[];
  weight: number;
  format: string;
}

// Pattern definitions for different SOP types
const CONTENT_PATTERNS: ContentPattern[] = [
  // Technical/Troubleshooting patterns
  {
    name: 'technical_indicators',
    patterns: [
      /prerequisites?/i,
      /symptoms?/i,
      /diagnostic/i,
      /resolution/i,
      /troubleshoot/i,
      /error\s+(?:logs?|messages?)/i,
      /check\s+(?:logs?|status|connection)/i,
      /restart|reboot/i,
      /configuration/i,
    ],
    weight: 0.8,
    format: 'technical'
  },

  // Decision tree patterns
  {
    name: 'decision_indicators',
    patterns: [
      /if\s+.*(?:then|:)/i,
      /(?:yes|no)\s*[→→>-]\s*/i,
      /condition/i,
      /decision/i,
      /branch/i,
      /escalate/i,
      /approval/i,
      /^q\d*[:.]\s*/im,
      /choice/i,
    ],
    weight: 0.9,
    format: 'decision-tree'
  },

  // Process flow patterns
  {
    name: 'process_indicators',
    patterns: [
      /^step\s+\d+/im,
      /^\d+\.\s+/m,
      /next,?\s+/i,
      /then,?\s+/i,
      /procedure/i,
      /workflow/i,
      /sequence/i,
      /follow(?:ing|ed\s+by)/i,
    ],
    weight: 0.7,
    format: 'process'
  },

  // Checklist patterns
  {
    name: 'checklist_indicators',
    patterns: [
      /\[\s*\]/,
      /☐|☑|✓|✗/,
      /verify/i,
      /confirm/i,
      /ensure/i,
      /validate/i,
      /review/i,
      /complete/i,
    ],
    weight: 0.8,
    format: 'checklist'
  },

  // Narrative/descriptive patterns
  {
    name: 'narrative_indicators',
    patterns: [
      /scenario/i,
      /situation/i,
      /context/i,
      /background/i,
      /story/i,
      /example/i,
      /case\s+study/i,
    ],
    weight: 0.6,
    format: 'narrative'
  }
];

// Semantic keywords for content mapping
export const SEMANTIC_KEYWORDS = {
  objectives: [
    'goal', 'objective', 'purpose', 'aim', 'target', 'outcome', 'result',
    'achieve', 'accomplish', 'deliver', 'ensure', 'provide', 'establish',
    'mission', 'vision', 'intent', 'desired', 'expected'
  ],
  
  activities: [
    'step', 'task', 'activity', 'action', 'process', 'procedure', 'method',
    'approach', 'technique', 'practice', 'execute', 'perform', 'conduct',
    'implement', 'carry out', 'follow', 'complete', 'do', 'run'
  ],
  
  deliverables: [
    'output', 'deliverable', 'result', 'product', 'artifact', 'document',
    'report', 'record', 'file', 'create', 'generate', 'produce', 'build',
    'develop', 'prepare', 'submit', 'provide', 'deliver'
  ],
  
  roles: [
    'role', 'responsibility', 'responsible', 'accountable', 'owner', 'lead',
    'manager', 'team', 'stakeholder', 'approver', 'reviewer', 'coordinator',
    'specialist', 'expert', 'contact', 'person', 'authority'
  ],
  
  tools: [
    'tool', 'template', 'system', 'software', 'platform', 'application',
    'resource', 'framework', 'methodology', 'technique', 'instrument',
    'equipment', 'utility', 'service', 'interface', 'dashboard'
  ],
  
  pitfalls: [
    'avoid', 'don\'t', 'not', 'never', 'warning', 'caution', 'risk', 'danger',
    'issue', 'problem', 'mistake', 'error', 'pitfall', 'trap', 'concern',
    'watch out', 'be careful', 'beware', 'common mistake'
  ],
  
  practices: [
    'best practice', 'tip', 'recommendation', 'suggestion', 'advice',
    'guidance', 'hint', 'technique', 'approach', 'method', 'strategy',
    'proven', 'effective', 'successful', 'optimal', 'preferred'
  ]
};

/**
 * Main function to detect SOP format and analyze structure
 */
export function detectSOPFormat(markdown: string): FormatDetectionResult {
  const structure = analyzeStructure(markdown);
  const formatScores = calculateFormatScores(markdown, structure);
  const bestFormat = getBestFormat(formatScores);
  
  return {
    detectedFormat: bestFormat.format,
    confidence: bestFormat.score,
    patterns: bestFormat.matchedPatterns,
    structure
  };
}

/**
 * Analyze the structural characteristics of the markdown
 */
function analyzeStructure(markdown: string): StructureAnalysis {
  const lines = markdown.split('\n');
  const sections = extractSections(markdown);
  
  return {
    hasNumberedLists: /^\s*\d+\.\s+/m.test(markdown),
    hasBulletLists: /^\s*[-*+]\s+/m.test(markdown),
    hasConditionalLogic: /\b(?:if|when|unless|condition|branch)\b/i.test(markdown),
    hasCodeBlocks: /```|`[^`]+`/.test(markdown),
    hasDecisionPoints: /(?:yes|no)\s*[→>-]|decision|choice/i.test(markdown),
    hasTechnicalTerms: /\b(?:server|database|config|log|error|system|network)\b/i.test(markdown),
    hasRoleDefinitions: /\b(?:manager|team|lead|responsible|accountable)\b/i.test(markdown),
    sectionCount: sections.length,
    averageSectionLength: sections.length > 0 ? 
      sections.reduce((sum, s) => sum + s.content.length, 0) / sections.length : 0
  };
}

/**
 * Extract sections from markdown
 */
function extractSections(markdown: string) {
  const sections: Array<{title: string; level: number; content: string}> = [];
  const lines = markdown.split('\n');
  
  let currentSection: {title: string; level: number; content: string} | null = null;
  
  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start new section
      currentSection = {
        title: headerMatch[2].trim(),
        level: headerMatch[1].length,
        content: ''
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
  }
  
  // Save final section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Calculate confidence scores for each potential format
 */
function calculateFormatScores(markdown: string, structure: StructureAnalysis): Array<{
  format: string;
  score: number;
  matchedPatterns: string[];
}> {
  const scores = new Map<string, {score: number; patterns: string[]}>();
  
  // Initialize format scores
  const formats = ['technical', 'decision-tree', 'process', 'checklist', 'narrative', 'generic'];
  formats.forEach(format => {
    scores.set(format, {score: 0, patterns: []});
  });
  
  // Score based on content patterns
  for (const patternGroup of CONTENT_PATTERNS) {
    let matches = 0;
    
    for (const pattern of patternGroup.patterns) {
      if (pattern.test(markdown)) {
        matches++;
      }
    }
    
    if (matches > 0) {
      const matchRatio = matches / patternGroup.patterns.length;
      const score = matchRatio * patternGroup.weight;
      
      const currentScore = scores.get(patternGroup.format)!;
      currentScore.score += score;
      currentScore.patterns.push(patternGroup.name);
    }
  }
  
  // Adjust scores based on structural analysis
  adjustScoresByStructure(scores, structure);
  
  // Convert to array and sort
  return Array.from(scores.entries())
    .map(([format, data]) => ({
      format,
      score: Math.min(1.0, data.score), // Cap at 1.0
      matchedPatterns: data.patterns
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Adjust format scores based on structural characteristics
 */
function adjustScoresByStructure(
  scores: Map<string, {score: number; patterns: string[]}>,
  structure: StructureAnalysis
) {
  // Technical format bonuses
  if (structure.hasCodeBlocks || structure.hasTechnicalTerms) {
    const technical = scores.get('technical')!;
    technical.score += 0.2;
    technical.patterns.push('structural_technical');
  }
  
  // Decision tree bonuses
  if (structure.hasConditionalLogic || structure.hasDecisionPoints) {
    const decisionTree = scores.get('decision-tree')!;
    decisionTree.score += 0.3;
    decisionTree.patterns.push('structural_conditional');
  }
  
  // Process flow bonuses
  if (structure.hasNumberedLists) {
    const process = scores.get('process')!;
    process.score += 0.25;
    process.patterns.push('structural_numbered');
  }
  
  // Checklist bonuses
  if (structure.hasBulletLists && structure.sectionCount > 3) {
    const checklist = scores.get('checklist')!;
    checklist.score += 0.2;
    checklist.patterns.push('structural_lists');
  }
  
  // Generic fallback - always has some score
  const generic = scores.get('generic')!;
  generic.score = Math.max(0.1, generic.score);
}

/**
 * Get the best format with highest confidence
 */
function getBestFormat(formatScores: Array<{
  format: string;
  score: number;
  matchedPatterns: string[];
}>) {
  // If no format has decent confidence, use generic
  const bestFormat = formatScores[0];
  
  if (bestFormat.score < 0.3) {
    return {
      format: 'generic',
      score: 0.5, // Generic always has reasonable confidence
      matchedPatterns: ['fallback']
    };
  }
  
  return bestFormat;
}

/**
 * Check if content matches semantic keywords for a specific field
 */
export function matchesSemanticKeywords(content: string, field: keyof typeof SEMANTIC_KEYWORDS): number {
  const keywords = SEMANTIC_KEYWORDS[field];
  const contentLower = content.toLowerCase();
  
  let matches = 0;
  for (const keyword of keywords) {
    if (contentLower.includes(keyword)) {
      matches++;
    }
  }
  
  return matches / keywords.length; // Return ratio of matched keywords
}

/**
 * Find sections that are semantically similar to target content types
 */
export function findSemanticMatches(
  sections: Array<{title: string; content: string}>,
  targetField: keyof typeof SEMANTIC_KEYWORDS,
  threshold: number = 0.2
): Array<{section: {title: string; content: string}; score: number}> {
  const matches: Array<{section: {title: string; content: string}; score: number}> = [];
  
  for (const section of sections) {
    const titleScore = matchesSemanticKeywords(section.title, targetField);
    const contentScore = matchesSemanticKeywords(section.content, targetField);
    const combinedScore = (titleScore * 0.7) + (contentScore * 0.3); // Title weighted higher
    
    if (combinedScore >= threshold) {
      matches.push({section, score: combinedScore});
    }
  }
  
  return matches.sort((a, b) => b.score - a.score);
}