import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageFeedback extends Document {
  messageId: string;
  sessionId: string;
  rating: 'helpful' | 'not_helpful';
  sopUsed: string;
  confidence: number;
  feedbackReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageFeedbackSchema = new Schema<IMessageFeedback>({
  messageId: {
    type: String,
    required: true,
    index: true,
    description: 'ID of the AI message being rated'
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
    description: 'Chat session ID for grouping feedback'
  },
  rating: {
    type: String,
    required: true,
    enum: ['helpful', 'not_helpful'],
    description: 'User rating of the message'
  },
  sopUsed: {
    type: String,
    required: true,
    match: /^SOP-\d{3}$/,
    description: 'Which SOP was used for this response'
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    description: 'AI confidence score for this response'
  },
  feedbackReason: {
    type: String,
    description: 'Optional reason for negative feedback'
  }
}, {
  timestamps: true,
  collection: 'message_feedback'
});

// Compound index to ensure one rating per message
MessageFeedbackSchema.index({ messageId: 1, sessionId: 1 }, { unique: true });

// Index for analytics queries
MessageFeedbackSchema.index({ sopUsed: 1, rating: 1 });
MessageFeedbackSchema.index({ createdAt: -1 });
MessageFeedbackSchema.index({ confidence: 1, rating: 1 });

// Static method to get feedback stats for a SOP
MessageFeedbackSchema.statics.getSOPStats = async function(sopId: string) {
  const stats = await this.aggregate([
    { $match: { sopUsed: sopId } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const helpful = stats.find(s => s._id === 'helpful')?.count || 0;
  const notHelpful = stats.find(s => s._id === 'not_helpful')?.count || 0;
  const total = helpful + notHelpful;
  
  return {
    helpful,
    notHelpful,
    total,
    helpfulnessRate: total > 0 ? (helpful / total * 100).toFixed(1) : 0
  };
};

// Static method to get confidence accuracy correlation
MessageFeedbackSchema.statics.getConfidenceAccuracy = async function() {
  return this.aggregate([
    {
      $bucket: {
        groupBy: '$confidence',
        boundaries: [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        default: 'other',
        output: {
          total: { $sum: 1 },
          helpful: {
            $sum: { $cond: [{ $eq: ['$rating', 'helpful'] }, 1, 0] }
          }
        }
      }
    },
    {
      $project: {
        confidenceRange: '$_id',
        total: 1,
        helpful: 1,
        helpfulnessRate: {
          $cond: [
            { $gt: ['$total', 0] },
            { $multiply: [{ $divide: ['$helpful', '$total'] }, 100] },
            0
          ]
        }
      }
    }
  ]);
};

const MessageFeedback = mongoose.models.MessageFeedback || 
  mongoose.model<IMessageFeedback>('MessageFeedback', MessageFeedbackSchema);

export default MessageFeedback;