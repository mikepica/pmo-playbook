import { HumanSOP } from '@/models/HumanSOP';
import { getSOPDirectoryConfig, debugLog } from './ai-config';
import fs from 'fs/promises';
import path from 'path';

export interface SOPDirectoryEntry {
  sopId: string;
  title: string;
  summary: string;
  topics: string[];
  relatedSOPs: string[];
  lastUpdated: Date;
}

export class SOPDirectoryGenerator {
  private static instance: SOPDirectoryGenerator;
  private directoryPath: string;
  
  private constructor() {
    const config = getSOPDirectoryConfig();
    this.directoryPath = path.resolve(process.cwd(), config.directory_file);
  }

  public static getInstance(): SOPDirectoryGenerator {
    if (!SOPDirectoryGenerator.instance) {
      SOPDirectoryGenerator.instance = new SOPDirectoryGenerator();
    }
    return SOPDirectoryGenerator.instance;
  }

  /**
   * Generate the complete SOP directory
   */
  public async generateDirectory(): Promise<void> {
    try {
      debugLog('log_sop_selection_reasoning', 'Starting SOP directory generation');
      
      const config = getSOPDirectoryConfig();
      if (!config.auto_generate) {
        debugLog('log_sop_selection_reasoning', 'SOP directory auto-generation is disabled');
        return;
      }

      // Get all active SOPs
      const humanSOPs = await HumanSOP.getAllActiveSOPs();
      debugLog('log_sop_selection_reasoning', `Found ${humanSOPs.length} active SOPs`);

      // Generate directory entries
      const entries: SOPDirectoryEntry[] = [];
      for (const sop of humanSOPs) {
        const entry = await this.generateSOPEntry(sop);
        entries.push(entry);
      }

      // Generate markdown content
      const markdownContent = await this.generateMarkdownContent(entries);

      // Write to file
      await fs.writeFile(this.directoryPath, markdownContent, 'utf8');
      
      debugLog('log_sop_selection_reasoning', `SOP directory generated successfully: ${this.directoryPath}`);
    } catch (error) {
      console.error('Failed to generate SOP directory:', error);
      throw error;
    }
  }

  /**
   * Generate a directory entry for a single SOP
   */
  private async generateSOPEntry(sop: any): Promise<SOPDirectoryEntry> {
    const config = getSOPDirectoryConfig();
    
    // Extract summary from markdown content
    const summary = config.include_summaries ? 
      this.extractSummary(sop.data.markdownContent) : 
      'Summary not available';

    // Extract topics from content
    const topics = config.include_topics ? 
      await this.extractTopics(sop.data.markdownContent, sop.data.title) : 
      [];

    // Find related SOPs (placeholder for now - would use semantic similarity in full implementation)
    const relatedSOPs = config.include_relationships ? 
      await this.findRelatedSOPs(sop.sopId, sop.data.title, sop.data.markdownContent) : 
      [];

    return {
      sopId: sop.sopId,
      title: sop.data.title,
      summary,
      topics,
      relatedSOPs,
      lastUpdated: new Date(sop.updatedAt)
    };
  }

  /**
   * Extract a concise summary from markdown content
   */
  private extractSummary(markdownContent: string): string {
    // Remove headers and markdown formatting
    const cleanText = markdownContent
      .replace(/^#{1,6}\s+/gm, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .replace(/\n\s*\n/g, ' ') // Collapse multiple newlines
      .trim();

    // Get first paragraph or first 200 characters
    const firstParagraph = cleanText.split('\n')[0];
    if (firstParagraph.length <= 200) {
      return firstParagraph;
    }

    // Truncate at sentence boundary near 200 characters
    const truncated = cleanText.substring(0, 200);
    const lastSentence = truncated.lastIndexOf('.');
    if (lastSentence > 100) {
      return truncated.substring(0, lastSentence + 1);
    }

    return truncated + '...';
  }

  /**
   * Extract topics/themes from SOP content
   */
  private async extractTopics(markdownContent: string, title: string): Promise<string[]> {
    const topics: string[] = [];
    
    // Extract from headers
    const headers = markdownContent.match(/^#{1,6}\s+(.+)$/gm) || [];
    headers.forEach(header => {
      const cleanHeader = header.replace(/^#{1,6}\s+/, '').trim();
      if (cleanHeader.length > 3 && cleanHeader.length < 50) {
        topics.push(cleanHeader);
      }
    });

    // Common PM topics based on keywords
    const pmKeywords = [
      'project planning', 'risk management', 'stakeholder', 'budget', 'schedule',
      'resource management', 'quality assurance', 'change management', 'communication',
      'deliverable', 'milestone', 'timeline', 'scope', 'requirements', 'testing',
      'deployment', 'governance', 'reporting', 'documentation', 'review',
      'approval', 'procurement', 'vendor', 'contract', 'training'
    ];

    const contentLower = (title + ' ' + markdownContent).toLowerCase();
    pmKeywords.forEach(keyword => {
      if (contentLower.includes(keyword)) {
        topics.push(keyword);
      }
    });

    // Remove duplicates and limit to top 5
    return [...new Set(topics)].slice(0, 5);
  }

  /**
   * Find related SOPs based on content similarity and common topics
   */
  private async findRelatedSOPs(currentSopId: string, title: string, content: string): Promise<string[]> {
    try {
      const allSOPs = await HumanSOP.getAllActiveSOPs();
      const related: { sopId: string, score: number }[] = [];

      // Simple keyword-based similarity for now
      const currentKeywords = this.extractKeywords(title + ' ' + content);

      for (const sop of allSOPs) {
        if (sop.sopId === currentSopId) continue;

        const otherKeywords = this.extractKeywords(sop.data.title + ' ' + sop.data.markdownContent);
        const similarity = this.calculateKeywordSimilarity(currentKeywords, otherKeywords);
        
        if (similarity > 0.2) { // Threshold for relatedness
          related.push({ sopId: sop.sopId, score: similarity });
        }
      }

      // Return top 3 related SOPs
      return related
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(r => r.sopId);

    } catch (error) {
      console.warn('Failed to find related SOPs:', error);
      return [];
    }
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Count word frequency
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Return top keywords
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  /**
   * Calculate similarity between two keyword sets
   */
  private calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Generate the markdown content for the directory
   */
  private async generateMarkdownContent(entries: SOPDirectoryEntry[]): Promise<string> {
    const config = getSOPDirectoryConfig();
    const now = new Date();

    let content = `# SOP Directory

*Auto-generated on ${now.toISOString().split('T')[0]} at ${now.toTimeString().split(' ')[0]}*

This directory provides an overview of all Standard Operating Procedures (SOPs) in the system. It is automatically updated when SOPs are created, modified, or deleted.

## Table of Contents

`;

    // Generate table of contents
    entries.forEach(entry => {
      content += `- [${entry.title}](#${this.slugify(entry.title)})\n`;
    });

    content += `\n---\n\n`;

    // Generate detailed entries
    entries.forEach(entry => {
      content += `## ${entry.title}\n\n`;
      content += `**SOP ID:** ${entry.sopId}\n\n`;
      
      if (config.include_summaries) {
        content += `**Summary:** ${entry.summary}\n\n`;
      }

      if (config.include_topics && entry.topics.length > 0) {
        content += `**Topics:** ${entry.topics.join(', ')}\n\n`;
      }

      if (config.include_relationships && entry.relatedSOPs.length > 0) {
        content += `**Related SOPs:** ${entry.relatedSOPs.join(', ')}\n\n`;
      }

      content += `**Last Updated:** ${entry.lastUpdated.toISOString().split('T')[0]}\n\n`;
      content += `---\n\n`;
    });

    // Add footer
    content += `\n*This directory contains ${entries.length} SOPs and was last updated on ${now.toISOString()}*\n`;
    
    if (config.editable_in_admin) {
      content += `\n> **Note:** This file can be edited in the Admin Center. However, changes will be overwritten when the directory is regenerated.`;
    }

    return content;
  }

  /**
   * Convert title to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Update directory when a SOP is created, updated, or deleted
   */
  public async updateOnSOPChange(changeType: 'create' | 'update' | 'delete', sopId: string): Promise<void> {
    try {
      const config = getSOPDirectoryConfig();
      
      const shouldUpdate = 
        (changeType === 'create' && config.update_on_sop_create) ||
        (changeType === 'update' && config.update_on_sop_edit) ||
        (changeType === 'delete' && config.update_on_sop_delete);

      if (shouldUpdate) {
        debugLog('log_sop_selection_reasoning', `SOP ${changeType} detected for ${sopId}, updating directory`);
        await this.generateDirectory();
      }
    } catch (error) {
      console.error(`Failed to update SOP directory on ${changeType}:`, error);
      // Don't throw - directory update shouldn't break SOP operations
    }
  }

  /**
   * Get the current directory path
   */
  public getDirectoryPath(): string {
    return this.directoryPath;
  }

  /**
   * Check if directory file exists
   */
  public async directoryExists(): Promise<boolean> {
    try {
      await fs.access(this.directoryPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const sopDirectoryGenerator = SOPDirectoryGenerator.getInstance();

// Convenience functions
export const generateSOPDirectory = () => sopDirectoryGenerator.generateDirectory();
export const updateSOPDirectoryOnChange = (changeType: 'create' | 'update' | 'delete', sopId: string) => 
  sopDirectoryGenerator.updateOnSOPChange(changeType, sopId);
export const getSOPDirectoryPath = () => sopDirectoryGenerator.getDirectoryPath();