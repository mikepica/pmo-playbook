import { PostgresModel } from '@/lib/postgres-model';

export interface ProjectData {
  projectName: string;
  sponsor: string;
  projectTeam: string[];
  keyStakeholders: string[];
  projectObjectives: string[];
  businessCaseSummary: string;
  resourceRequirements: string;
  scopeDeliverables: string[];
  keyDatesMilestones: Array<{ date: Date; description: string }>;
  threats: string[];
  opportunities: string[];
  keyAssumptions: string[];
  successCriteria: string[];
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface ProjectRecord {
  id: number;
  projectId: string;
  data: ProjectData;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectModel extends PostgresModel {
  constructor() {
    super('projects');
  }
  
  async findByProjectId(projectId: string): Promise<ProjectRecord | null> {
    const result = await this.findOne({ project_id: projectId });
    if (result) {
      return {
        id: result.id,
        projectId: result.project_id,
        data: result.data,
        isActive: result.is_active,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }
    return null;
  }
  
  async getActiveProjects(): Promise<ProjectRecord[]> {
    const results = await this.findMany(
      { is_active: true },
      { orderBy: 'project_id ASC' }
    );
    return results.map(row => ({
      id: row.id,
      projectId: row.project_id,
      data: row.data,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  
  async getAllProjects(): Promise<ProjectRecord[]> {
    const results = await this.findMany({}, { orderBy: 'project_id ASC' });
    return results.map(row => ({
      id: row.id,
      projectId: row.project_id,
      data: row.data,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  
  async createProject(projectId: string, data: ProjectData): Promise<ProjectRecord> {
    const result = await this.create({
      project_id: projectId,
      data: JSON.stringify(data),
      is_active: true
    });
    return {
      id: result.id,
      projectId: result.project_id,
      data: result.data,
      isActive: result.is_active,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }
  
  async updateProject(projectId: string, updates: Partial<ProjectData>): Promise<ProjectRecord | null> {
    const existing = await this.findOne({ project_id: projectId });
    if (!existing) return null;
    
    const mergedData = { ...existing.data, ...updates };
    const results = await this.update(
      { project_id: projectId },
      { data: JSON.stringify(mergedData) }
    );
    
    if (results.length > 0) {
      const result = results[0];
      return {
        id: result.id,
        projectId: result.project_id,
        data: result.data,
        isActive: result.is_active,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }
    return null;
  }
  
  async deleteProject(projectId: string): Promise<boolean> {
    const results = await this.update(
      { project_id: projectId },
      { is_active: false }
    );
    return results.length > 0;
  }
  
  async getNextProjectId(): Promise<string> {
    const result = await this.pool.query(`
      SELECT project_id FROM projects 
      ORDER BY project_id DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return 'PRO-001';
    }
    
    const lastId = result.rows[0].project_id;
    const lastNumber = parseInt(lastId.split('-')[1]);
    const nextNumber = lastNumber + 1;
    return `PRO-${nextNumber.toString().padStart(3, '0')}`;
  }
  
  // Method to get summary compatible with MongoDB model
  getSummary(project: ProjectRecord) {
    const nextMilestone = project.data.keyDatesMilestones
      ?.filter(m => new Date(m.date) > new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null;
    
    return {
      projectId: project.projectId,
      projectName: project.data.projectName,
      sponsor: project.data.sponsor,
      teamSize: project.data.projectTeam?.length || 0,
      deliverableCount: project.data.scopeDeliverables?.length || 0,
      nextMilestone
    };
  }
}

export const Project = new ProjectModel();