import { PostgresModel } from '@/lib/postgres-model';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  selectedSopId?: string;
  confidence?: number;
}

export interface SOPUsage {
  sopId: string;
  usageCount: number;
  lastUsed: Date;
}

export interface ChatMetadata {
  userAgent?: string;
  ipAddress?: string;
  duration?: number;
  feedbackScore?: number;
  feedbackComment?: string;
}

export interface ChatHistoryData {
  sessionName?: string;
  summary?: string;
  messages: ChatMessage[];
  sopUsage: SOPUsage[];
  metadata: ChatMetadata;
  tags: string[];
}

export interface ChatHistoryRecord {
  id: number;
  sessionId: string;
  userId: string | null;
  data: ChatHistoryData;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatHistoryModel extends PostgresModel {
  constructor() {
    super('chat_histories');
  }
  
  async findBySessionId(sessionId: string): Promise<ChatHistoryRecord | null> {
    const result = await this.findOne({ session_id: sessionId });
    if (result) {
      return this.mapToRecord(result);
    }
    return null;
  }
  
  async getActiveSessions(limit: number = 10): Promise<ChatHistoryRecord[]> {
    const results = await this.findMany(
      { status: 'active' },
      { orderBy: 'started_at DESC', limit }
    );
    return results.map(row => this.mapToRecord(row));
  }
  
  async createSession(sessionId: string, userId?: string): Promise<ChatHistoryRecord> {
    const data: ChatHistoryData = {
      messages: [],
      sopUsage: [],
      metadata: {},
      tags: []
    };
    
    const result = await this.create({
      session_id: sessionId,
      user_id: userId || null,
      data: JSON.stringify(data),
      status: 'active',
      started_at: new Date(),
      last_active: new Date()
    });
    
    return this.mapToRecord(result);
  }
  
  async addMessage(sessionId: string, message: Omit<ChatMessage, 'timestamp'>): Promise<ChatHistoryRecord | null> {
    const existing = await this.findOne({ session_id: sessionId });
    if (!existing) return null;
    
    const chatData: ChatHistoryData = existing.data;
    const newMessage: ChatMessage = {
      ...message,
      timestamp: new Date()
    };
    
    chatData.messages.push(newMessage);
    
    // Update SOP usage if applicable
    if (newMessage.selectedSopId) {
      const existingUsage = chatData.sopUsage.find(u => u.sopId === newMessage.selectedSopId);
      if (existingUsage) {
        existingUsage.usageCount++;
        existingUsage.lastUsed = newMessage.timestamp;
      } else {
        chatData.sopUsage.push({
          sopId: newMessage.selectedSopId,
          usageCount: 1,
          lastUsed: newMessage.timestamp
        });
      }
    }
    
    const results = await this.update(
      { session_id: sessionId },
      { 
        data: JSON.stringify(chatData),
        last_active: new Date()
      }
    );
    
    return results.length > 0 ? this.mapToRecord(results[0]) : null;
  }
  
  async endSession(sessionId: string, status: 'completed' | 'abandoned' = 'completed'): Promise<ChatHistoryRecord | null> {
    const results = await this.update(
      { session_id: sessionId },
      { 
        status,
        ended_at: new Date()
      }
    );
    
    return results.length > 0 ? this.mapToRecord(results[0]) : null;
  }
  
  async getSOPUsageStats(startDate?: Date, endDate?: Date): Promise<Array<{
    sopId: string;
    totalUsage: number;
    uniqueSessions: number;
    lastUsed: Date;
  }>> {
    let query = `
      SELECT 
        usage_item->>'sopId' as sop_id,
        SUM((usage_item->>'usageCount')::int) as total_usage,
        COUNT(DISTINCT session_id) as unique_sessions,
        MAX((usage_item->>'lastUsed')::timestamp) as last_used
      FROM chat_histories,
           jsonb_array_elements(data->'sopUsage') as usage_item
    `;
    
    const params: any[] = [];
    
    if (startDate || endDate) {
      query += ' WHERE ';
      const conditions = [];
      
      if (startDate) {
        params.push(startDate);
        conditions.push(`started_at >= $${params.length}`);
      }
      
      if (endDate) {
        params.push(endDate);
        conditions.push(`started_at <= $${params.length}`);
      }
      
      query += conditions.join(' AND ');
    }
    
    query += `
      GROUP BY usage_item->>'sopId'
      ORDER BY total_usage DESC
    `;
    
    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      sopId: row.sop_id,
      totalUsage: parseInt(row.total_usage),
      uniqueSessions: parseInt(row.unique_sessions),
      lastUsed: row.last_used
    }));
  }
  
  private mapToRecord(row: any): ChatHistoryRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      data: row.data,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      lastActive: row.last_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const ChatHistory = new ChatHistoryModel();