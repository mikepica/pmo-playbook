import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  selectedSopId?: string;
  confidence?: number;
}

interface IChatHistoryModel extends mongoose.Model<IChatHistory> {
  getActiveSessions(limit?: number): Promise<IChatHistory[]>;
  getSOPUsageStats(startDate?: Date, endDate?: Date): Promise<Array<{
    _id: string;
    totalUsage: number;
    uniqueSessions: number;
  }>>;
}

export interface IChatHistory extends Document {
  sessionId: string;
  sessionName?: string;
  summary?: string;
  userId?: string;
  messages: IMessage[];
  sopUsage: {
    sopId: string;
    usageCount: number;
    lastUsed: Date;
  }[];
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    duration?: number;
    feedbackScore?: number;
    feedbackComment?: string;
  };
  tags: string[];
  status: 'active' | 'completed' | 'abandoned';
  startedAt: Date;
  endedAt?: Date;
  lastActive?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  addMessage(message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    selectedSopId?: string;
    confidence?: number;
  }): Promise<IChatHistory>;
  endSession(status?: 'completed' | 'abandoned'): Promise<IChatHistory>;
}

const MessageSchema = new Schema<IMessage>({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  selectedSopId: {
    type: String,
    match: /^SOP-\d{3}$/,
    description: 'SOP ID used to generate this response'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    description: 'AI confidence score for SOP selection'
  }
}, { _id: false });

const SopUsageSchema = new Schema({
  sopId: {
    type: String,
    required: true,
    match: /^SOP-\d{3}$/
  },
  usageCount: {
    type: Number,
    default: 1,
    min: 1
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const ChatHistorySchema = new Schema<IChatHistory>({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: 'Unique session identifier'
  },
  sessionName: {
    type: String,
    description: 'User-editable name for the session'
  },
  summary: {
    type: String,
    description: 'AI-generated summary of the conversation'
  },
  userId: {
    type: String,
    index: true,
    description: 'Optional user identifier for future auth'
  },
  messages: {
    type: [MessageSchema],
    required: true,
    validate: {
      validator: function(messages: IMessage[]) {
        return messages.length > 0;
      },
      message: 'Chat history must contain at least one message'
    }
  },
  sopUsage: {
    type: [SopUsageSchema],
    default: []
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    duration: {
      type: Number,
      description: 'Session duration in seconds'
    },
    feedbackScore: {
      type: Number,
      min: 1,
      max: 5
    },
    feedbackComment: String
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date,
  lastActive: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'Last time this session was viewed or had activity'
  }
}, {
  timestamps: true,
  collection: 'chat_histories'
});

// Indexes for efficient querying
ChatHistorySchema.index({ status: 1, startedAt: -1 });
ChatHistorySchema.index({ 'sopUsage.sopId': 1 });
ChatHistorySchema.index({ tags: 1 });
ChatHistorySchema.index({ 'messages.content': 'text' });

// Pre-save middleware to update SOP usage stats
ChatHistorySchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    // Update SOP usage based on messages
    const sopUsageMap = new Map<string, { count: number; lastUsed: Date }>();
    
    this.messages.forEach(msg => {
      if (msg.selectedSopId) {
        const existing = sopUsageMap.get(msg.selectedSopId);
        if (existing) {
          existing.count++;
          existing.lastUsed = msg.timestamp;
        } else {
          sopUsageMap.set(msg.selectedSopId, {
            count: 1,
            lastUsed: msg.timestamp
          });
        }
      }
    });
    
    this.sopUsage = Array.from(sopUsageMap.entries()).map(([sopId, usage]) => ({
      sopId,
      usageCount: usage.count,
      lastUsed: usage.lastUsed
    }));
  }
  
  // Update session duration if ending
  if (this.endedAt && this.startedAt) {
    this.metadata.duration = Math.round((this.endedAt.getTime() - this.startedAt.getTime()) / 1000);
  }
  
  next();
});

// Static method to get active sessions
ChatHistorySchema.statics.getActiveSessions = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ startedAt: -1 })
    .limit(limit)
    .select('sessionId userId startedAt messages');
};

// Static method to get SOP usage statistics
ChatHistorySchema.statics.getSOPUsageStats = async function(startDate?: Date, endDate?: Date) {
  const match: { startedAt?: { $gte?: Date; $lte?: Date } } = {};
  if (startDate || endDate) {
    match.startedAt = {};
    if (startDate) match.startedAt.$gte = startDate;
    if (endDate) match.startedAt.$lte = endDate;
  }
  
  const pipeline = [
    { $match: match },
    { $unwind: '$sopUsage' },
    {
      $group: {
        _id: '$sopUsage.sopId',
        totalUsage: { $sum: '$sopUsage.usageCount' },
        uniqueSessions: { $sum: 1 },
        lastUsed: { $max: '$sopUsage.lastUsed' }
      }
    },
    { $sort: { totalUsage: -1 } }
  ];
  
  return this.aggregate(pipeline);
};

// Instance method to add a message
ChatHistorySchema.methods.addMessage = function(message: Partial<IMessage>) {
  this.messages.push({
    role: message.role!,
    content: message.content!,
    timestamp: message.timestamp || new Date(),
    selectedSopId: message.selectedSopId,
    confidence: message.confidence
  });
  return this.save();
};

// Instance method to end session
ChatHistorySchema.methods.endSession = function(status: 'completed' | 'abandoned' = 'completed') {
  this.status = status;
  this.endedAt = new Date();
  return this.save();
};

const ChatHistory = (mongoose.models.ChatHistory || mongoose.model<IChatHistory, IChatHistoryModel>('ChatHistory', ChatHistorySchema)) as IChatHistoryModel;

export default ChatHistory;