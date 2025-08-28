import { PostgresModel } from '@/lib/postgres';

export interface ChangeProposalData {
  proposalTitle: string;
  proposalDescription: string;
  sopId: string;
  originalContent?: string;
  proposedContent: string;
  justification: string;
  impactAssessment?: string;
  submittedBy: string;
  reviewedBy?: string;
  implementedBy?: string;
  reviewComments?: string;
  implementationNotes?: string;
}

export interface ChangeProposalRecord {
  id: number;
  proposalId: string;
  sopId: string;
  data: ChangeProposalData;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ChangeProposalModel extends PostgresModel {
  constructor() {
    super('change_proposals');
  }
  
  async findByProposalId(proposalId: string): Promise<ChangeProposalRecord | null> {
    const result = await this.findOne({ proposal_id: proposalId });
    if (result) {
      return this.mapToRecord(result);
    }
    return null;
  }
  
  async findBySopId(sopId: string): Promise<ChangeProposalRecord[]> {
    const results = await this.findMany({ sop_id: sopId });
    return results.map(row => this.mapToRecord(row));
  }
  
  async findByStatus(status: string): Promise<ChangeProposalRecord[]> {
    const results = await this.findMany({ status });
    return results.map(row => this.mapToRecord(row));
  }
  
  async createProposal(proposalId: string, sopId: string, data: ChangeProposalData, status: string = 'pending', priority: string = 'medium'): Promise<ChangeProposalRecord> {
    const result = await super.create({
      proposal_id: proposalId,
      sop_id: sopId,
      data: JSON.stringify(data),
      status,
      priority
    });
    
    return this.mapToRecord(result);
  }
  
  async updateStatus(proposalId: string, status: string, reviewComments?: string): Promise<ChangeProposalRecord | null> {
    const existing = await this.findByProposalId(proposalId);
    if (!existing) return null;
    
    const updatedData = { ...existing.data };
    if (reviewComments) {
      updatedData.reviewComments = reviewComments;
    }
    
    const results = await this.update(
      { proposal_id: proposalId },
      { 
        status,
        data: JSON.stringify(updatedData)
      }
    );
    
    return results.length > 0 ? this.mapToRecord(results[0]) : null;
  }
  
  private mapToRecord(row: any): ChangeProposalRecord {
    return {
      id: row.id,
      proposalId: row.proposal_id,
      sopId: row.sop_id,
      data: row.data,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const ChangeProposal = new ChangeProposalModel();