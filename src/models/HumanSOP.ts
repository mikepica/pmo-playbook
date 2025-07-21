import mongoose, { Schema, Document } from 'mongoose';

export interface IHumanSOP extends Document {
  sopId: string;
  title: string;
  phase: number;
  markdownContent: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  lastModifiedBy?: string;
}

const HumanSOPSchema = new Schema<IHumanSOP>({
  sopId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^SOP-\d{3}$/,
    description: 'Unique identifier in format SOP-XXX'
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  phase: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    description: 'PMO phase number (1-5)'
  },
  markdownContent: {
    type: String,
    required: true,
    description: 'Full markdown content of the SOP'
  },
  version: {
    type: Number,
    default: 1,
    min: 1,
    description: 'Version number for tracking changes'
  },
  isActive: {
    type: Boolean,
    default: true,
    description: 'Whether this SOP is currently active'
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  lastModifiedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true,
  collection: 'human_sops'
});

// Indexes for efficient querying
HumanSOPSchema.index({ phase: 1, isActive: 1 });
HumanSOPSchema.index({ title: 'text' });

// Pre-save middleware to auto-increment version on update
HumanSOPSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified('markdownContent')) {
    this.version += 1;
  }
  next();
});

// Static method to get active SOPs by phase
HumanSOPSchema.statics.getActiveByPhase = function(phase: number) {
  return this.find({ phase, isActive: true }).sort({ sopId: 1 });
};

// Instance method to create a version snapshot
HumanSOPSchema.methods.createSnapshot = function() {
  return {
    sopId: this.sopId,
    version: this.version,
    content: this.markdownContent,
    snapshotDate: new Date()
  };
};

const HumanSOP = mongoose.models.HumanSOP || mongoose.model<IHumanSOP>('HumanSOP', HumanSOPSchema);

export default HumanSOP;