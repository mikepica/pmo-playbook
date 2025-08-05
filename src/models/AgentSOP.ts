import mongoose, { Schema, Document, Types } from 'mongoose';

interface IAgentSOPModel extends mongoose.Model<IAgentSOP> {
  getAllSummaries(): Promise<Array<{
    sopId: string;
    title: string;
    phase: number;
    summary: string;
    keywords: string[];
  }>>;
  searchByKeywords(keywords: string[]): Promise<IAgentSOP[]>;
  findBySopId(sopId: string): Promise<IAgentSOP | null>;
}

interface ISection {
  objectives: string[];
  keyActivities: string[];
  deliverables: string[];
  rolesResponsibilities: { role: string; responsibilities: string[] }[];
  toolsTemplates: string[];
  bestPractices?: string[];
  commonPitfalls?: string[];
}

export interface IAgentSOP extends Document {
  sopId: string;
  humanSopId: Types.ObjectId;
  title: string;
  phase: number;
  summary: string;
  description: string;
  sections: ISection;
  searchableContent: string;
  keywords: string[];
  relatedSopIds: string[];
  version: number;
  isActive: boolean;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  generateAIContext(): {
    sopId: string;
    title: string;
    phase: number;
    summary: string;
    description: string;
    sections: ISection;
    keywords: string[];
    relatedSops: string[];
  };
}

const SectionSchema = new Schema<ISection>({
  objectives: [{
    type: String,
    trim: true
  }],
  keyActivities: [{
    type: String,
    trim: true
  }],
  deliverables: [{
    type: String,
    trim: true
  }],
  rolesResponsibilities: [{
    role: {
      type: String,
      trim: true
    },
    responsibilities: [{
      type: String,
      trim: true
    }]
  }],
  toolsTemplates: [{
    type: String,
    trim: true
  }],
  bestPractices: [{
    type: String,
    trim: true
  }],
  commonPitfalls: [{
    type: String,
    trim: true
  }]
}, { _id: false });

const AgentSOPSchema = new Schema<IAgentSOP>({
  sopId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^SOP-\d{3}$/
  },
  humanSopId: {
    type: Schema.Types.ObjectId,
    ref: 'HumanSOP',
    required: true,
    description: 'Reference to the source HumanSOP document'
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
    max: 5
  },
  summary: {
    type: String,
    required: true,
    maxlength: 500,
    description: 'Brief summary for AI to quickly understand the SOP'
  },
  description: {
    type: String,
    required: true,
    description: 'Detailed description of what this SOP covers'
  },
  sections: {
    type: SectionSchema,
    required: true
  },
  searchableContent: {
    type: String,
    required: false,
    description: 'Concatenated searchable text from all sections'
  },
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  relatedSopIds: [{
    type: String,
    match: /^SOP-\d{3}$/
  }],
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now,
    description: 'Last time this was synced with HumanSOP'
  }
}, {
  timestamps: true,
  collection: 'agent_sops'
});

// Indexes for efficient querying
AgentSOPSchema.index({ phase: 1, isActive: 1 });
AgentSOPSchema.index({ keywords: 1 });
AgentSOPSchema.index({ searchableContent: 'text' });
AgentSOPSchema.index({ 'sections.keyActivities': 1 });

// Pre-save middleware to update searchable content
AgentSOPSchema.pre('save', function(next) {
  const sections = this.sections;
  const searchableText = [
    this.title,
    this.summary,
    this.description,
    ...sections.objectives,
    ...sections.keyActivities,
    ...sections.deliverables,
    ...sections.toolsTemplates,
    ...(sections.bestPractices || []),
    ...(sections.commonPitfalls || []),
    ...sections.rolesResponsibilities.flatMap(r => [r.role, ...r.responsibilities])
  ].join(' ');
  
  this.searchableContent = searchableText.toLowerCase();
  next();
});

// Static method to find best matching SOP for a query
AgentSOPSchema.statics.findBestMatch = async function(query: string) {
  const results = await this.find(
    { 
      $text: { $search: query },
      isActive: true 
    },
    { 
      score: { $meta: 'textScore' } 
    }
  ).sort({ score: { $meta: 'textScore' } }).limit(5);
  
  return results;
};

// Static method to get all SOP summaries for AI selection
AgentSOPSchema.statics.getAllSummaries = function() {
  return this.find(
    { isActive: true },
    { sopId: 1, title: 1, summary: 1, phase: 1, keywords: 1 }
  ).sort({ phase: 1, sopId: 1 });
};

// Instance method to generate context for AI
AgentSOPSchema.methods.generateAIContext = function() {
  return {
    sopId: this.sopId,
    title: this.title,
    phase: this.phase,
    summary: this.summary,
    sections: this.sections,
    keywords: this.keywords,
    relatedSops: this.relatedSopIds
  };
};

const AgentSOP = (mongoose.models.AgentSOP || mongoose.model<IAgentSOP, IAgentSOPModel>('AgentSOP', AgentSOPSchema)) as IAgentSOPModel;

export default AgentSOP;