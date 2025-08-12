import { PostgresModel } from '@/lib/postgres-model';

export interface UserFeedbackData {
  feedbackType: 'bug' | 'feature_request' | 'improvement' | 'general';
  title: string;
  description: string;
  sessionId?: string;
  sopId?: string;
  rating?: number;
  category?: string;
  submittedBy: string;
  userEmail?: string;
  attachments?: string[];
  reproductionSteps?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  browserInfo?: string;
  adminResponse?: string;
  adminNotes?: string;
}

export interface UserFeedbackRecord {
  id: number;
  feedbackId: string;
  sessionId: string | null;
  data: UserFeedbackData;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserFeedbackModel extends PostgresModel {
  constructor() {
    super('user_feedback');
  }
  
  async findByFeedbackId(feedbackId: string): Promise<UserFeedbackRecord | null> {
    const result = await this.findOne({ feedback_id: feedbackId });
    if (result) {
      return this.mapToRecord(result);
    }
    return null;
  }
  
  async findBySessionId(sessionId: string): Promise<UserFeedbackRecord[]> {
    const results = await this.findMany({ session_id: sessionId });
    return results.map(row => this.mapToRecord(row));
  }
  
  async findByStatus(status: string): Promise<UserFeedbackRecord[]> {
    const results = await this.findMany({ status });
    return results.map(row => this.mapToRecord(row));
  }
  
  async getAllFeedback(limit: number = 50): Promise<UserFeedbackRecord[]> {
    const results = await this.findMany({}, { orderBy: 'created_at DESC', limit });
    return results.map(row => this.mapToRecord(row));
  }
  
  async createFeedback(feedbackId: string, data: UserFeedbackData, sessionId?: string, status: string = 'open', priority: string = 'medium'): Promise<UserFeedbackRecord> {
    const result = await super.create({
      feedback_id: feedbackId,
      session_id: sessionId || null,
      data: JSON.stringify(data),
      status,
      priority
    });
    
    return this.mapToRecord(result);
  }
  
  async updateStatus(feedbackId: string, status: string, adminResponse?: string): Promise<UserFeedbackRecord | null> {
    const existing = await this.findByFeedbackId(feedbackId);
    if (!existing) return null;
    
    const updatedData = { ...existing.data };
    if (adminResponse) {
      updatedData.adminResponse = adminResponse;
    }
    
    const results = await this.update(
      { feedback_id: feedbackId },
      { 
        status,
        data: JSON.stringify(updatedData)
      }
    );
    
    return results.length > 0 ? this.mapToRecord(results[0]) : null;
  }
  
  private mapToRecord(row: any): UserFeedbackRecord {
    return {
      id: row.id,
      feedbackId: row.feedback_id,
      sessionId: row.session_id,
      data: row.data,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const UserFeedback = new UserFeedbackModel();