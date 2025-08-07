import { PostgresModel } from '@/lib/postgres-model';

export interface MessageFeedbackData {
  messageId: string;
  sessionId: string;
  rating: number; // 1-5 scale
  sopUsed: string;
  confidence: number; // 0-1 scale
  feedbackReason?: string;
  specificIssues?: string[];
  suggestions?: string;
  responseQuality?: number;
  sopRelevance?: number;
  overallSatisfaction?: number;
  submittedBy?: string;
  timestamp: Date;
}

export interface MessageFeedbackRecord {
  id: number;
  messageId: string;
  sessionId: string;
  data: MessageFeedbackData;
  createdAt: Date;
  updatedAt: Date;
}

export class MessageFeedbackModel extends PostgresModel {
  constructor() {
    super('message_feedback');
  }
  
  async findByMessageId(messageId: string): Promise<MessageFeedbackRecord | null> {
    const result = await this.findOne({ message_id: messageId });
    if (result) {
      return this.mapToRecord(result);
    }
    return null;
  }
  
  async findBySessionId(sessionId: string): Promise<MessageFeedbackRecord[]> {
    const results = await this.findMany({ session_id: sessionId });
    return results.map(row => this.mapToRecord(row));
  }
  
  async getRecentFeedback(limit: number = 100): Promise<MessageFeedbackRecord[]> {
    const results = await this.findMany({}, { orderBy: 'created_at DESC', limit });
    return results.map(row => this.mapToRecord(row));
  }
  
  async create(messageId: string, sessionId: string, data: MessageFeedbackData): Promise<MessageFeedbackRecord> {
    const result = await this.create({
      message_id: messageId,
      session_id: sessionId,
      data: JSON.stringify(data)
    });
    
    return this.mapToRecord(result);
  }
  
  async getFeedbackStats(): Promise<{
    averageRating: number;
    totalFeedback: number;
    ratingDistribution: Record<number, number>;
    averageConfidence: number;
  }> {
    const query = `
      SELECT 
        AVG((data->>'rating')::numeric) as avg_rating,
        COUNT(*) as total_feedback,
        AVG((data->>'confidence')::numeric) as avg_confidence,
        (data->>'rating')::numeric as rating,
        COUNT((data->>'rating')::numeric) as rating_count
      FROM message_feedback 
      GROUP BY (data->>'rating')::numeric
      ORDER BY rating
    `;
    
    const result = await this.pool.query(query);
    
    const ratingDistribution: Record<number, number> = {};
    let totalFeedback = 0;
    let totalRating = 0;
    let totalConfidence = 0;
    
    for (const row of result.rows) {
      const rating = parseInt(row.rating);
      const count = parseInt(row.rating_count);
      ratingDistribution[rating] = count;
      totalFeedback += count;
      totalRating += rating * count;
      totalConfidence += parseFloat(row.avg_confidence || '0') * count;
    }
    
    return {
      averageRating: totalFeedback > 0 ? totalRating / totalFeedback : 0,
      totalFeedback,
      ratingDistribution,
      averageConfidence: totalFeedback > 0 ? totalConfidence / totalFeedback : 0
    };
  }
  
  private mapToRecord(row: any): MessageFeedbackRecord {
    return {
      id: row.id,
      messageId: row.message_id,
      sessionId: row.session_id,
      data: row.data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const MessageFeedback = new MessageFeedbackModel();