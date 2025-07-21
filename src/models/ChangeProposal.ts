import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChangeProposal extends Document {
  proposalId: string;
  sopId: string;
  humanSopId: Types.ObjectId;
  triggerQuery: string;
  conversationContext: {
    sessionId: string;
    messages: {
      role: string;
      content: string;
    }[];
    timestamp: Date;
  };
  proposedChange: {
    section: string;
    originalContent: string;
    suggestedContent: string;
    changeType: 'addition' | 'modification' | 'deletion' | 'clarification';
    rationale: string;
  };
  status: 'pending_review' | 'approved' | 'rejected' | 'implemented' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reviewHistory: {
    action: 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'implemented';
    performedBy: string;
    timestamp: Date;
    comments?: string;
  }[];
  implementationDetails?: {
    newVersion: number;
    implementedAt: Date;
    implementedBy: string;
    rollbackVersion?: number;
  };
  metrics: {
    similarProposalsCount: number;
    affectedUsersCount: number;
    confidenceScore: number;
  };
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationContextSchema = new Schema({
  sessionId: {
    type: String,
    required: true
  },
  messages: [{
    role: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    }
  }],
  timestamp: {
    type: Date,
    required: true
  }
}, { _id: false });

const ProposedChangeSchema = new Schema({
  section: {
    type: String,
    required: true,
    description: 'Section of the SOP to be changed'
  },
  originalContent: {
    type: String,
    required: true,
    description: 'Current content in the SOP'
  },
  suggestedContent: {
    type: String,
    required: true,
    description: 'Proposed new content'
  },
  changeType: {
    type: String,
    enum: ['addition', 'modification', 'deletion', 'clarification'],
    required: true
  },
  rationale: {
    type: String,
    required: true,
    description: 'Explanation for why this change is needed'
  }
}, { _id: false });

const ReviewHistorySchema = new Schema({
  action: {
    type: String,
    enum: ['submitted', 'reviewed', 'approved', 'rejected', 'implemented'],
    required: true
  },
  performedBy: {
    type: String,
    required: true,
    default: 'system'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  comments: String
}, { _id: false });

const ChangeProposalSchema = new Schema<IChangeProposal>({
  proposalId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: function() {
      return `PROP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  sopId: {
    type: String,
    required: true,
    match: /^SOP-\d{3}$/,
    index: true
  },
  humanSopId: {
    type: Schema.Types.ObjectId,
    ref: 'HumanSOP',
    required: true
  },
  triggerQuery: {
    type: String,
    required: true,
    description: 'The user query that triggered this proposal'
  },
  conversationContext: {
    type: ConversationContextSchema,
    required: true
  },
  proposedChange: {
    type: ProposedChangeSchema,
    required: true
  },
  status: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected', 'implemented', 'archived'],
    default: 'pending_review',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    description: 'Priority based on impact and frequency'
  },
  reviewHistory: {
    type: [ReviewHistorySchema],
    default: function() {
      return [{
        action: 'submitted',
        performedBy: 'system',
        timestamp: new Date()
      }];
    }
  },
  implementationDetails: {
    newVersion: Number,
    implementedAt: Date,
    implementedBy: String,
    rollbackVersion: Number
  },
  metrics: {
    similarProposalsCount: {
      type: Number,
      default: 0,
      description: 'Number of similar proposals for the same issue'
    },
    affectedUsersCount: {
      type: Number,
      default: 1,
      description: 'Number of users who encountered this gap'
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
      description: 'AI confidence in the proposed change'
    }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true,
  collection: 'change_proposals'
});

// Indexes for efficient querying
ChangeProposalSchema.index({ status: 1, priority: -1, createdAt: -1 });
ChangeProposalSchema.index({ 'proposedChange.changeType': 1 });
ChangeProposalSchema.index({ tags: 1 });
ChangeProposalSchema.index({ 'metrics.confidenceScore': -1 });

// Pre-save middleware to auto-calculate priority
ChangeProposalSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('metrics')) {
    // Auto-adjust priority based on metrics
    if (this.metrics.affectedUsersCount > 10 || this.metrics.confidenceScore > 0.9) {
      this.priority = 'high';
    } else if (this.metrics.affectedUsersCount > 5 || this.metrics.confidenceScore > 0.7) {
      this.priority = 'medium';
    } else {
      this.priority = 'low';
    }
    
    // Critical if many users affected and high confidence
    if (this.metrics.affectedUsersCount > 20 && this.metrics.confidenceScore > 0.85) {
      this.priority = 'critical';
    }
  }
  next();
});

// Static method to find similar proposals
ChangeProposalSchema.statics.findSimilarProposals = async function(sopId: string, section: string, changeType: string) {
  return this.find({
    sopId,
    'proposedChange.section': section,
    'proposedChange.changeType': changeType,
    status: { $in: ['pending_review', 'approved'] }
  }).sort({ createdAt: -1 });
};

// Static method to get proposals by status and priority
ChangeProposalSchema.statics.getProposalsByStatusAndPriority = function(status?: string, priority?: string) {
  const query: any = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  
  return this.find(query)
    .populate('humanSopId', 'title version')
    .sort({ priority: -1, 'metrics.confidenceScore': -1, createdAt: -1 });
};

// Instance method to approve proposal
ChangeProposalSchema.methods.approve = function(approvedBy: string, comments?: string) {
  this.status = 'approved';
  this.reviewHistory.push({
    action: 'approved',
    performedBy: approvedBy,
    timestamp: new Date(),
    comments
  });
  return this.save();
};

// Instance method to reject proposal
ChangeProposalSchema.methods.reject = function(rejectedBy: string, reason: string) {
  this.status = 'rejected';
  this.reviewHistory.push({
    action: 'rejected',
    performedBy: rejectedBy,
    timestamp: new Date(),
    comments: reason
  });
  return this.save();
};

// Instance method to mark as implemented
ChangeProposalSchema.methods.markImplemented = function(implementedBy: string, newVersion: number) {
  this.status = 'implemented';
  this.implementationDetails = {
    newVersion,
    implementedAt: new Date(),
    implementedBy
  };
  this.reviewHistory.push({
    action: 'implemented',
    performedBy: implementedBy,
    timestamp: new Date()
  });
  return this.save();
};

const ChangeProposal = mongoose.models.ChangeProposal || mongoose.model<IChangeProposal>('ChangeProposal', ChangeProposalSchema);

export default ChangeProposal;