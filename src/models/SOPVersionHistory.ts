import mongoose, { Schema, Document } from 'mongoose';

export interface ISOPVersionHistory extends Document {
  sopId: string;
  sopType: 'human' | 'agent';
  version: number;
  content: string | object;
  changedBy: string;
  changeType: 'create' | 'update' | 'regenerate' | 'rollback';
  changeReason?: string;
  metadata?: {
    previousVersion?: number;
    regenerationErrors?: string[];
    regenerationWarnings?: string[];
  };
  createdAt: Date;
}

const SOPVersionHistorySchema = new Schema<ISOPVersionHistory>({
  sopId: {
    type: String,
    required: true,
    index: true,
    match: /^SOP-\d{3}$/
  },
  sopType: {
    type: String,
    required: true,
    enum: ['human', 'agent']
  },
  version: {
    type: Number,
    required: true,
    min: 1
  },
  content: {
    type: Schema.Types.Mixed,
    required: true,
    description: 'Full content snapshot at this version'
  },
  changedBy: {
    type: String,
    required: true,
    default: 'system'
  },
  changeType: {
    type: String,
    required: true,
    enum: ['create', 'update', 'regenerate', 'rollback']
  },
  changeReason: {
    type: String,
    description: 'Optional reason for the change'
  },
  metadata: {
    previousVersion: Number,
    regenerationErrors: [String],
    regenerationWarnings: [String]
  }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'sop_version_history'
});

// Compound index for efficient version lookups
SOPVersionHistorySchema.index({ sopId: 1, sopType: 1, version: -1 });
SOPVersionHistorySchema.index({ sopId: 1, createdAt: -1 });

// Static method to create a version entry
SOPVersionHistorySchema.statics.createVersion = async function(
  sopId: string,
  sopType: 'human' | 'agent',
  version: number,
  content: string | object,
  changeType: ISOPVersionHistory['changeType'],
  changedBy: string = 'system',
  metadata?: ISOPVersionHistory['metadata']
) {
  return this.create({
    sopId,
    sopType,
    version,
    content,
    changedBy,
    changeType,
    metadata
  });
};

// Static method to get version history for an SOP
SOPVersionHistorySchema.statics.getHistory = function(
  sopId: string,
  sopType?: 'human' | 'agent',
  limit: number = 10
) {
  const query: { sopId: string; sopType?: 'human' | 'agent' } = { sopId };
  if (sopType) query.sopType = sopType;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-content'); // Exclude content for list view
};

// Static method to get a specific version
SOPVersionHistorySchema.statics.getVersion = function(
  sopId: string,
  sopType: 'human' | 'agent',
  version: number
) {
  return this.findOne({ sopId, sopType, version });
};

// Instance method to get diff summary
SOPVersionHistorySchema.methods.getDiffSummary = function() {
  return {
    sopId: this.sopId,
    sopType: this.sopType,
    version: this.version,
    changedBy: this.changedBy,
    changeType: this.changeType,
    changeReason: this.changeReason,
    createdAt: this.createdAt,
    metadata: this.metadata
  };
};

const SOPVersionHistory = mongoose.models.SOPVersionHistory || 
  mongoose.model<ISOPVersionHistory>('SOPVersionHistory', SOPVersionHistorySchema);

export default SOPVersionHistory;