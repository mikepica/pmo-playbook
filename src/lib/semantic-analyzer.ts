// Semantic Analysis for SOP Organization and Selection
// Leverages existing sop-parser and sop-detector capabilities

import { detectSOPFormat, findSemanticMatches } from './sop-detector';
import { parseSOPMarkdown } from './sop-parser';
import { AgentSOP } from '@/models/AgentSOP';

export interface SemanticMatch {
  sopId: string;
  title: string;
  similarity: number;
  format: string;
  topics: string[];
  relationships: string[];
}

export interface TopicCluster {
  topic: string;
  sopIds: string[];
  keywords: string[];
  formats: string[];
}

export class SemanticAnalyzer {
  
  /**
   * Analyze semantic similarity between user query and available SOPs
   */
  static async findSemanticMatches(userQuery: string, threshold: number = 0.5): Promise<SemanticMatch[]> {
    try {
      // Get all SOPs with their content
      const sopSummaries = await AgentSOP.getAllSummaries();
      const matches: SemanticMatch[] = [];

      for (const sop of sopSummaries) {
        // Calculate similarity score based on multiple factors
        const similarity = this.calculateSimilarity(userQuery, sop);
        
        if (similarity >= threshold) {
          // Get format information
          const formatDetection = detectSOPFormat(sop.summary);
          
          // Extract topics from keywords and activities
          const topics = this.extractTopics(sop);
          
          // Find relationships with other SOPs
          const relationships = this.findRelationships(sop, sopSummaries);

          matches.push({
            sopId: sop.sopId,
            title: sop.title,
            similarity,
            format: formatDetection.detectedFormat,
            topics,
            relationships
          });
        }
      }

      // Sort by similarity score
      return matches.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.error('Error in semantic matching:', error);
      return [];
    }
  }

  /**
   * Group SOPs into topic clusters
   */
  static async clusterByTopics(): Promise<TopicCluster[]> {
    try {
      const sopSummaries = await AgentSOP.getAllSummaries();
      const clusters = new Map<string, TopicCluster>();

      for (const sop of sopSummaries) {
        const topics = this.extractTopics(sop);
        const formatDetection = detectSOPFormat(sop.summary);

        for (const topic of topics) {
          if (!clusters.has(topic)) {
            clusters.set(topic, {
              topic,
              sopIds: [],
              keywords: [],
              formats: []
            });
          }

          const cluster = clusters.get(topic)!;
          cluster.sopIds.push(sop.sopId);
          cluster.keywords.push(...sop.keywords);
          cluster.formats.push(formatDetection.detectedFormat);
        }
      }

      // Clean up clusters and remove duplicates
      const result = Array.from(clusters.values()).map(cluster => ({
        ...cluster,
        keywords: [...new Set(cluster.keywords)],
        formats: [...new Set(cluster.formats)]
      }));

      return result.filter(cluster => cluster.sopIds.length > 0);
    } catch (error) {
      console.error('Error in topic clustering:', error);
      return [];
    }
  }

  /**
   * Enhanced SOP selection using multiple semantic factors
   */
  static async selectOptimalSOPs(
    userQuery: string,
    maxSOPs: number = 3,
    qualityThreshold: number = 0.6
  ): Promise<{
    primary: SemanticMatch | null;
    supporting: SemanticMatch[];
    strategy: 'semantic_multi' | 'quality_filtered' | 'fallback';
    reasoning: string;
  }> {
    const matches = await this.findSemanticMatches(userQuery, 0.3);
    
    if (matches.length === 0) {
      return {
        primary: null,
        supporting: [],
        strategy: 'fallback',
        reasoning: 'No semantic matches found above threshold'
      };
    }

    // Filter by quality if we have quality scores
    const qualityFiltered = matches.filter(match => {
      // Use similarity as quality proxy for now
      return match.similarity >= qualityThreshold;
    });

    if (qualityFiltered.length === 0) {
      return {
        primary: matches[0],
        supporting: matches.slice(1, maxSOPs),
        strategy: 'quality_filtered',
        reasoning: 'Used top matches despite low quality scores'
      };
    }

    const primary = qualityFiltered[0];
    const supporting = qualityFiltered.slice(1, maxSOPs);

    return {
      primary,
      supporting,
      strategy: 'semantic_multi',
      reasoning: `Selected ${supporting.length + 1} SOPs based on semantic similarity and quality`
    };
  }

  /**
   * Calculate similarity between query and SOP
   */
  private static calculateSimilarity(query: string, sop: any): number {
    const queryWords = this.extractWords(query.toLowerCase());
    let score = 0;
    let matches = 0;

    // Check title similarity
    const titleWords = this.extractWords(sop.title.toLowerCase());
    for (const word of queryWords) {
      if (titleWords.includes(word)) {
        score += 0.3;
        matches++;
      }
    }

    // Check keyword matches
    const sopKeywords = sop.keywords?.map((k: string) => k.toLowerCase()) || [];
    for (const word of queryWords) {
      if (sopKeywords.some(k => k.includes(word) || word.includes(k))) {
        score += 0.25;
        matches++;
      }
    }

    // Check activity matches
    const activities = sop.keyActivities?.join(' ').toLowerCase() || '';
    for (const word of queryWords) {
      if (activities.includes(word)) {
        score += 0.2;
        matches++;
      }
    }

    // Check summary matches
    const summaryWords = this.extractWords(sop.summary.toLowerCase());
    for (const word of queryWords) {
      if (summaryWords.includes(word)) {
        score += 0.15;
        matches++;
      }
    }

    // Normalize by query length
    return Math.min(score / Math.max(queryWords.length, 1), 1.0);
  }

  /**
   * Extract meaningful topics from SOP data
   */
  private static extractTopics(sop: any): string[] {
    const topics = new Set<string>();
    
    // Extract from keywords
    if (sop.keywords) {
      sop.keywords.forEach((keyword: string) => {
        if (keyword.length > 3) {
          topics.add(keyword.toLowerCase());
        }
      });
    }

    // Extract from title
    const titleWords = this.extractWords(sop.title.toLowerCase());
    titleWords.forEach(word => {
      if (word.length > 4) {
        topics.add(word);
      }
    });

    // Extract from activities (key concepts)
    if (sop.keyActivities) {
      const activityText = sop.keyActivities.join(' ').toLowerCase();
      const conceptWords = activityText.match(/\b(manage|plan|execute|control|monitor|review|analyze|implement|design|create|develop|establish|maintain|coordinate|communicate)\w*/g);
      if (conceptWords) {
        conceptWords.forEach(concept => topics.add(concept));
      }
    }

    return Array.from(topics).slice(0, 10); // Limit to top 10 topics
  }

  /**
   * Find relationships between SOPs
   */
  private static findRelationships(sop: any, allSOPs: any[]): string[] {
    const relationships: string[] = [];
    
    for (const otherSOP of allSOPs) {
      if (otherSOP.sopId === sop.sopId) continue;

      // Check for keyword overlap
      const sharedKeywords = sop.keywords?.filter((k: string) => 
        otherSOP.keywords?.includes(k)
      ) || [];

      if (sharedKeywords.length > 0) {
        relationships.push(`related_to_${otherSOP.sopId}`);
      }

      // Check for activity dependencies
      if (sop.keyActivities && otherSOP.keyActivities) {
        const hasWorkflowConnection = this.checkWorkflowConnection(
          sop.keyActivities,
          otherSOP.keyActivities
        );
        if (hasWorkflowConnection) {
          relationships.push(`depends_on_${otherSOP.sopId}`);
        }
      }
    }

    return relationships.slice(0, 5); // Limit to top 5 relationships
  }

  /**
   * Check if two sets of activities have workflow connections
   */
  private static checkWorkflowConnection(activities1: string[], activities2: string[]): boolean {
    const workflows = [
      ['plan', 'implement'],
      ['design', 'develop'],
      ['create', 'review'],
      ['establish', 'maintain'],
      ['initiate', 'execute'],
      ['analyze', 'report']
    ];

    for (const [first, second] of workflows) {
      const has1 = activities1.some(a => a.toLowerCase().includes(first));
      const has2 = activities2.some(a => a.toLowerCase().includes(second));
      if (has1 && has2) return true;
    }

    return false;
  }

  /**
   * Extract words from text, filtering common words
   */
  private static extractWords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall']);
    
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 20); // Limit to prevent processing very long queries
  }
}