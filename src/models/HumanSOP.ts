import { PostgresModel } from '@/lib/postgres';
import { invalidateSOPCache } from '@/lib/sop-cache';

export interface HumanSOPData {
  title: string;
  markdownContent: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface HumanSOPRecord {
  id: number;
  sopId: string;
  slug?: string;
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

  async findBySlug(slug: string): Promise<HumanSOPRecord | null> {
    const result = await this.findOne({ slug: slug, is_active: true });
    if (result) {
      return this.mapToRecord(result);
    }
    return null;
  }

  async findBySopIdOrSlug(identifier: string): Promise<HumanSOPRecord | null> {
    // Try to find by slug first (preferred)
    let result = await this.findOne({ slug: identifier, is_active: true });
    
    // If not found by slug, try by SOP ID for minimal backward compatibility
    if (!result) {
      result = await this.findOne({ sop_id: identifier, is_active: true });
    }
    
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
    const slug = await this.generateUniqueSlug(data.title);
    
    const result = await this.create({
      sop_id: sopId,
      slug: slug,
      data: JSON.stringify(data),
      version: 1,
      is_active: true
    });
    
    const record = this.mapToRecord(result);
    
    // Invalidate cache for new SOP
    try {
      await invalidateSOPCache(sopId);
    } catch (error) {
      console.warn('Failed to invalidate SOP cache after create:', error);
    }
    
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
    
    // Generate new slug if title is being updated
    let updateFields: any = { 
      data: JSON.stringify(mergedData),
      version: existing.version + 1
    };
    
    if (updates.title && updates.title !== existing.data.title) {
      updateFields.slug = await this.generateUniqueSlug(updates.title, existing.slug);
    }
    
    const results = await super.update(
      { sop_id: sopId },
      updateFields
    );
    
    if (results.length > 0) {
      const record = this.mapToRecord(results[0]);
      
      // Invalidate cache for updated SOP
      try {
        await invalidateSOPCache(sopId);
      } catch (error) {
        console.warn('Failed to invalidate SOP cache after update:', error);
      }
      
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
      // Invalidate cache for deleted SOP
      try {
        await invalidateSOPCache(sopId);
      } catch (error) {
        console.warn('Failed to invalidate SOP cache after delete:', error);
      }
      
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
      slug: row.slug,
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

  // Generate a URL-friendly slug from text
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  // Generate a unique slug, handling duplicates
  private async generateUniqueSlug(title: string, currentSlug?: string): Promise<string> {
    const baseSlug = this.generateSlug(title);
    
    // If this is the same as the current slug, return it
    if (currentSlug === baseSlug) {
      return baseSlug;
    }
    
    let slug = baseSlug;
    let counter = 1;
    
    // Check for duplicates and append numbers if necessary
    while (await this.slugExists(slug, currentSlug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  // Check if a slug already exists (excluding the current record)
  private async slugExists(slug: string, currentSlug?: string): Promise<boolean> {
    const query = currentSlug 
      ? `SELECT 1 FROM human_sops WHERE slug = $1 AND slug != $2 AND is_active = true LIMIT 1`
      : `SELECT 1 FROM human_sops WHERE slug = $1 AND is_active = true LIMIT 1`;
    
    const params = currentSlug ? [slug, currentSlug] : [slug];
    const result = await this.pool.query(query, params);
    return result.rows.length > 0;
  }
}

export const HumanSOP = new HumanSOPModel();