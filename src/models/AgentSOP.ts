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
      keywords: row.data.keywords || []
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
}

export const AgentSOP = new AgentSOPModel();