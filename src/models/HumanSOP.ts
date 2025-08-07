import { PostgresModel } from '@/lib/postgres-model';

export interface HumanSOPData {
  title: string;
  markdownContent: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface HumanSOPRecord {
  id: number;
  sopId: string;
  phase: number;
  data: HumanSOPData;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class HumanSOPModel extends PostgresModel {
  constructor() {
    super('human_sops');
  }
  
  async findBySopId(sopId: string): Promise<HumanSOPRecord | null> {
    const result = await this.findOne({ sop_id: sopId, is_active: true });
    if (result) {
      return this.mapToRecord(result);
    }
    return null;
  }
  
  async getActiveByPhase(phase: number): Promise<HumanSOPRecord[]> {
    const results = await this.findMany(
      { phase, is_active: true },
      { orderBy: 'sop_id ASC' }
    );
    return results.map(row => this.mapToRecord(row));
  }
  
  async getAllActiveSOPs(): Promise<HumanSOPRecord[]> {
    const results = await this.findMany(
      { is_active: true },
      { orderBy: 'phase ASC, sop_id ASC' }
    );
    return results.map(row => this.mapToRecord(row));
  }
  
  async createSOP(sopId: string, phase: number, data: HumanSOPData): Promise<HumanSOPRecord> {
    const result = await this.create({
      sop_id: sopId,
      phase,
      data: JSON.stringify(data),
      version: 1,
      is_active: true
    });
    return this.mapToRecord(result);
  }
  
  async updateSOP(sopId: string, updates: Partial<HumanSOPData>): Promise<HumanSOPRecord | null> {
    const existing = await this.findOne({ sop_id: sopId });
    if (!existing) return null;
    
    const mergedData = { ...existing.data, ...updates };
    const results = await this.update(
      { sop_id: sopId },
      { 
        data: JSON.stringify(mergedData),
        version: existing.version + 1
      }
    );
    
    if (results.length > 0) {
      return this.mapToRecord(results[0]);
    }
    return null;
  }
  
  async searchByTitle(searchTerm: string): Promise<HumanSOPRecord[]> {
    const query = `
      SELECT * FROM human_sops 
      WHERE is_active = true 
      AND data->>'title' ILIKE $1
      ORDER BY phase ASC, sop_id ASC
    `;
    const result = await this.pool.query(query, [`%${searchTerm}%`]);
    return result.rows.map(row => this.mapToRecord(row));
  }
  
  private mapToRecord(row: any): HumanSOPRecord {
    return {
      id: row.id,
      sopId: row.sop_id,
      phase: row.phase,
      data: row.data,
      version: row.version,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  // Method to create version snapshot (compatible with MongoDB model)
  createSnapshot(sop: HumanSOPRecord) {
    return {
      sopId: sop.sopId,
      version: sop.version,
      content: sop.data.markdownContent,
      snapshotDate: new Date()
    };
  }
}

export const HumanSOP = new HumanSOPModel();