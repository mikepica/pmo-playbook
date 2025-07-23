import mongoose, { Document, Schema, Types } from 'mongoose';

export interface AIsuggestion {
  content: string;
  rationale: string;
}

export interface UserFeedbackDocument extends Document {
  feedbackId: string;
  sessionId: string;
  messageId: string;
  
  // Context
  userQuestion: string;
  aiResponse: string;
  userComment: string;
  
  // SOP Info
  sopId: string;
  sopTitle: string;
  sopSection: string;
  confidence: number;
  
  // AI Suggestion (generated when admin views)
  aiSuggestion?: AIsuggestion;
  
  // Management
  status: 'pending' | 'ongoing' | 'completed' | 'closed';
  priority: 'low' | 'medium' | 'high';
  adminNotes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const UserFeedbackSchema = new Schema<UserFeedbackDocument>({
  feedbackId: {
    type: String,
    required: true,
    unique: true,
    default: () => `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  messageId: {
    type: String,
    required: true
  },
  
  // Context
  userQuestion: {
    type: String,
    required: true
  },
  aiResponse: {
    type: String,
    required: true
  },
  userComment: {
    type: String,
    required: true
  },
  
  // SOP Info
  sopId: {
    type: String,
    required: true,
    index: true
  },
  sopTitle: {
    type: String,
    required: true
  },
  sopSection: {
    type: String,
    required: false
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  
  // AI Suggestion (generated when admin views)
  aiSuggestion: {
    content: String,
    rationale: String
  },
  
  // Management
  status: {
    type: String,
    enum: ['pending', 'ongoing', 'completed', 'closed'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    index: true
  },
  adminNotes: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'userfeedback'
});

// Index for efficient querying
UserFeedbackSchema.index({ createdAt: -1 });
UserFeedbackSchema.index({ status: 1, priority: -1, createdAt: -1 });
UserFeedbackSchema.index({ sopId: 1, status: 1 });

// Static method to get feedback with counts
UserFeedbackSchema.statics.getFeedbackWithCounts = async function() {
  const pipeline = [
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ];
  
  const counts = await this.aggregate(pipeline);
  const countMap = counts.reduce((acc: Record<string, number>, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
  
  return {
    pending: countMap.pending || 0,
    ongoing: countMap.ongoing || 0,
    completed: countMap.completed || 0,
    closed: countMap.closed || 0,
    total: Object.values(countMap).reduce((sum: number, count) => sum + (count as number), 0)
  };
};

const UserFeedback = mongoose.models.UserFeedback || mongoose.model<UserFeedbackDocument>('UserFeedback', UserFeedbackSchema);

export default UserFeedback;