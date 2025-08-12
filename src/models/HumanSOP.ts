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
  
  async getAllActiveSOPs(): Promise<HumanSOPRecord[]> {
    const results = await this.findMany(
      { is_active: true },
      { orderBy: 'sop_id ASC' }
    );
    return results.map(row => this.mapToRecord(row));
  }
  
  async createSOP(sopId: string, data: HumanSOPData): Promise<HumanSOPRecord> {
    const result = await this.create({
      sop_id: sopId,
      data: JSON.stringify(data),
      version: 1,
      is_active: true
    });
    
    const record = this.mapToRecord(result);
    
    // TODO: Re-enable SOP directory update after fixing AI config issues
    // try {
    //   await updateSOPDirectoryOnChange('create', sopId);
    // } catch (error) {
    //   console.warn('Failed to update SOP directory after create:', error);
    // }
    
    return record;
  }
  
  async updateById(id: number, data: HumanSOPData, version: number): Promise<HumanSOPRecord> {
    const results = await super.update(
      { id },
      { 
        data: JSON.stringify(data),
        version
      }
    );
    
    if (results.length > 0) {
      return this.mapToRecord(results[0]);
    }
    throw new Error('Update failed - no rows returned');
  }

  async updateSOP(sopId: string, updates: Partial<HumanSOPData>): Promise<HumanSOPRecord | null> {
    const existing = await this.findOne({ sop_id: sopId });
    if (!existing) return null;
    
    const mergedData = { ...existing.data, ...updates };
    const results = await super.update(
      { sop_id: sopId },
      { 
        data: JSON.stringify(mergedData),
        version: existing.version + 1
      }
    );
    
    if (results.length > 0) {
      const record = this.mapToRecord(results[0]);
      
      // TODO: Re-enable SOP directory update after fixing AI config issues
      // try {
      //   await updateSOPDirectoryOnChange('update', sopId);
      // } catch (error) {
      //   console.warn('Failed to update SOP directory after update:', error);
      // }
      
      return record;
    }
    return null;
  }
  
  async deleteSOP(sopId: string): Promise<boolean> {
    const results = await super.update(
      { sop_id: sopId },
      { is_active: false }
    );
    
    if (results.length > 0) {
      // TODO: Re-enable SOP directory update after fixing AI config issues
      // try {
      //   await updateSOPDirectoryOnChange('delete', sopId);
      // } catch (error) {
      //   console.warn('Failed to update SOP directory after delete:', error);
      // }
      return true;
    }
    return false;
  }

  async searchByTitle(searchTerm: string): Promise<HumanSOPRecord[]> {
    const query = `
      SELECT * FROM human_sops 
      WHERE is_active = true 
      AND data->>'title' ILIKE $1
      ORDER BY sop_id ASC
    `;
    const result = await this.pool.query(query, [`%${searchTerm}%`]);
    return result.rows.map(row => this.mapToRecord(row));
  }
  
  private mapToRecord(row: any): HumanSOPRecord {
    return {
      id: row.id,
      sopId: row.sop_id,
      data: row.data,
      version: row.version,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  // Method to generate next available SOP ID
  async getNextSopId(): Promise<string> {
    const query = `
      SELECT sop_id FROM human_sops 
      WHERE sop_id ~ '^SOP-[0-9]{3}$'
      ORDER BY sop_id DESC 
      LIMIT 1
    `;
    const result = await this.pool.query(query);
    
    if (result.rows.length === 0) {
      return 'SOP-001';
    }
    
    const lastId = result.rows[0].sop_id;
    const lastNumber = parseInt(lastId.split('-')[1]);
    const nextNumber = lastNumber + 1;
    return `SOP-${nextNumber.toString().padStart(3, '0')}`;
  }

  // Method to create version snapshot for change tracking
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