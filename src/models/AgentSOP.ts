import { PostgresModel } from '@/lib/postgres-model';

export interface AgentSOPSection {
  objectives: string[];
  keyActivities: string[];
  deliverables: string[];
  rolesResponsibilities: { role: string; responsibilities: string[] }[];
  toolsTemplates: string[];
  bestPractices?: string[];
  commonPitfalls?: string[];
}

export interface AgentSOPData {
  title: string;
  summary: string;
  description: string;
  sections: AgentSOPSection;
  keywords: string[];
  relatedSopIds: string[];
  humanSopId?: string; // Reference to related HumanSOP ID
}

export interface AgentSOPRecord {
  id: number;
  sopId: string;
  humanSopId: number | null; // PostgreSQL foreign key
  phase: number;
  data: AgentSOPData;
  searchableContent: string;
  version: number;
  isActive: boolean;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class AgentSOPModel extends PostgresModel {
  constructor() {
    super('agent_sops');
  }
  
  async findBySopId(sopId: string): Promise<AgentSOPRecord | null> {
    const result = await this.findOne({ sop_id: sopId, is_active: true });
    if (result) {
      return this.mapToRecord(result);
    }
    return null;
  }
  
  async getActiveByPhase(phase: number): Promise<AgentSOPRecord[]> {
    const results = await this.findMany(
      { phase, is_active: true },
      { orderBy: 'sop_id ASC' }
    );
    return results.map(row => this.mapToRecord(row));
  }
  
  async getAllSummaries(): Promise<Array<{
    sopId: string;
    title: string;
    phase: number;
    summary: string;
    keywords: string[];
    keyActivities: string[];
    deliverables: string[];
  }>> {
    const query = `
      SELECT sop_id, phase, data
      FROM agent_sops 
      WHERE is_active = true
      ORDER BY phase ASC, sop_id ASC
    `;
    const result = await this.pool.query(query);
    
    return result.rows.map(row => ({
      sopId: row.sop_id,
      title: row.data.title,
      phase: row.phase,
      summary: row.data.summary,
      keywords: row.data.keywords || [],
      keyActivities: row.data.sections?.keyActivities?.slice(0, 3) || [],
      deliverables: row.data.sections?.deliverables?.slice(0, 3) || []
    }));
  }
  
  async searchByKeywords(keywords: string[]): Promise<AgentSOPRecord[]> {
    const keywordConditions = keywords.map((_, i) => `data @> '{"keywords": ["${keywords[i]}"]}'`).join(' OR ');
    const query = `
      SELECT * FROM agent_sops 
      WHERE is_active = true 
      AND (${keywordConditions})
      ORDER BY phase ASC, sop_id ASC
    `;
    const result = await this.pool.query(query);
    return result.rows.map(row => this.mapToRecord(row));
  }
  
  async findBestMatch(searchQuery: string): Promise<AgentSOPRecord[]> {
    const query = `
      SELECT *, ts_rank(to_tsvector('english', searchable_content), plainto_tsquery('english', $1)) as rank
      FROM agent_sops 
      WHERE is_active = true 
      AND to_tsvector('english', searchable_content) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC, phase ASC
      LIMIT 5
    `;
    const result = await this.pool.query(query, [searchQuery]);
    return result.rows.map(row => this.mapToRecord(row));
  }
  
  async createSOP(sopId: string, phase: number, data: AgentSOPData, humanSopId?: number): Promise<AgentSOPRecord> {
    // Generate searchable content
    const searchableContent = this.generateSearchableContent(data);
    
    const result = await this.create({
      sop_id: sopId,
      human_sop_id: humanSopId || null,
      phase,
      data: JSON.stringify(data),
      searchable_content: searchableContent,
      version: 1,
      is_active: true,
      last_synced_at: new Date()
    });
    
    return this.mapToRecord(result);
  }
  
  private generateSearchableContent(data: AgentSOPData): string {
    const sections = data.sections;
    return [
      data.title,
      data.summary,
      data.description,
      ...sections.objectives,
      ...sections.keyActivities,
      ...sections.deliverables,
      ...sections.toolsTemplates,
      ...(sections.bestPractices || []),
      ...(sections.commonPitfalls || []),
      ...sections.rolesResponsibilities.flatMap(r => [r.role, ...r.responsibilities])
    ].join(' ').toLowerCase();
  }
  
  private mapToRecord(row: any): AgentSOPRecord {
    return {
      id: row.id,
      sopId: row.sop_id,
      humanSopId: row.human_sop_id,
      phase: row.phase,
      data: row.data,
      searchableContent: row.searchable_content,
      version: row.version,
      isActive: row.is_active,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  // Method to generate AI context for LLM consumption
  generateAIContext(sop: AgentSOPRecord) {
    return {
      sopId: sop.sopId,
      title: sop.data.title,
      phase: sop.phase,
      summary: sop.data.summary,
      sections: sop.data.sections,
      keywords: sop.data.keywords,
      relatedSops: sop.data.relatedSopIds
    };
  }

  /**
   * Find multiple SOPs by their IDs
   */
  async findMultipleBySopIds(sopIds: string[]): Promise<AgentSOPRecord[]> {
    if (sopIds.length === 0) return [];
    
    const placeholders = sopIds.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      SELECT * FROM agent_sops 
      WHERE sop_id IN (${placeholders}) 
      AND is_active = true
      ORDER BY phase ASC, sop_id ASC
    `;
    
    const result = await this.pool.query(query, sopIds);
    return result.rows.map(row => this.mapToRecord(row));
  }

  /**
   * Find SOPs by keyword intersection (for multi-topic queries)
   */
  async findByKeywordIntersection(keywords: string[], limit: number = 5): Promise<Array<{
    sop: AgentSOPRecord;
    matchCount: number;
    matchedKeywords: string[];
  }>> {
    if (keywords.length === 0) return [];
    
    const keywordConditions = keywords.map((keyword, i) => 
      `data->'keywords' @> $${i + 1}`
    );
    
    const query = `
      SELECT *, 
             (${keywordConditions.map((_, i) => `CASE WHEN ${keywordConditions[i]} THEN 1 ELSE 0 END`).join(' + ')}) as match_count
      FROM agent_sops 
      WHERE is_active = true
      AND (${keywordConditions.join(' OR ')})
      ORDER BY match_count DESC, phase ASC
      LIMIT $${keywords.length + 1}
    `;
    
    const params = [...keywords.map(k => `"${k}"`), limit];
    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      sop: this.mapToRecord(row),
      matchCount: parseInt(row.match_count),
      matchedKeywords: keywords.filter(keyword => 
        row.data.keywords && row.data.keywords.includes(keyword)
      )
    }));
  }

  /**
   * Find SOPs related by phase proximity (for cross-phase queries)
   */
  async findByPhaseRange(centerPhase: number, range: number = 1): Promise<AgentSOPRecord[]> {
    const minPhase = Math.max(1, centerPhase - range);
    const maxPhase = Math.min(5, centerPhase + range);
    
    const query = `
      SELECT * FROM agent_sops 
      WHERE is_active = true
      AND phase BETWEEN $1 AND $2
      ORDER BY ABS(phase - $3) ASC, phase ASC, sop_id ASC
    `;
    
    const result = await this.pool.query(query, [minPhase, maxPhase, centerPhase]);
    return result.rows.map(row => this.mapToRecord(row));
  }

  /**
   * Score SOPs for relevance to a query
   */
  async scoreSOPsForQuery(query: string, maxSOPs: number = 3): Promise<Array<{
    sop: AgentSOPRecord;
    relevanceScore: number;
    reasoning: string;
  }>> {
    // Get all SOPs for scoring
    const allSOPs = await this.findMany({ is_active: true });
    
    // Simple scoring based on keyword matching and text similarity
    const scoredSOPs = allSOPs.map(sopRow => {
      const sop = this.mapToRecord(sopRow);
      const score = this.calculateRelevanceScore(query, sop);
      
      return {
        sop,
        relevanceScore: score.score,
        reasoning: score.reasoning
      };
    }).filter(result => result.relevanceScore > 0.1)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxSOPs);
    
    return scoredSOPs;
  }

  /**
   * Calculate relevance score for a SOP against a query
   */
  private calculateRelevanceScore(query: string, sop: AgentSOPRecord): { score: number; reasoning: string } {
    const queryLower = query.toLowerCase();
    const searchableContent = sop.searchableContent.toLowerCase();
    const keywords = sop.data.keywords?.map(k => k.toLowerCase()) || [];
    
    let score = 0;
    const reasons: string[] = [];
    
    // Keyword matching (high weight)
    const keywordMatches = keywords.filter(keyword => queryLower.includes(keyword));
    if (keywordMatches.length > 0) {
      score += keywordMatches.length * 0.3;
      reasons.push(`Keywords: ${keywordMatches.join(', ')}`);
    }
    
    // Title matching (medium weight)
    if (queryLower.includes(sop.data.title.toLowerCase()) || 
        sop.data.title.toLowerCase().includes(queryLower)) {
      score += 0.25;
      reasons.push('Title relevance');
    }
    
    // Summary matching (medium weight)
    const summaryWords = sop.data.summary.toLowerCase().split(/\s+/);
    const queryWords = queryLower.split(/\s+/);
    const commonWords = summaryWords.filter(word => 
      queryWords.some(qw => qw.includes(word) || word.includes(qw))
    );
    if (commonWords.length > 0) {
      score += Math.min(0.2, commonWords.length * 0.05);
      reasons.push('Summary relevance');
    }
    
    // Content matching (lower weight but comprehensive)
    const contentMatches = queryWords.filter(word => 
      word.length > 3 && searchableContent.includes(word)
    );
    if (contentMatches.length > 0) {
      score += Math.min(0.15, contentMatches.length * 0.03);
      reasons.push('Content relevance');
    }
    
    return {
      score: Math.min(1.0, score), // Cap at 1.0
      reasoning: reasons.length > 0 ? reasons.join('; ') : 'Basic content match'
    };
  }
}

export const AgentSOP = new AgentSOPModel();