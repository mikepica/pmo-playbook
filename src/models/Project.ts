import mongoose, { Schema, Document } from 'mongoose';

export interface IProjectMilestone {
  date: Date;
  description: string;
}

export interface IProject extends Document {
  projectId: string;
  projectName: string;
  sponsor: string;
  projectTeam: string[];
  keyStakeholders: string[];
  projectObjectives: string[];
  businessCaseSummary: string;
  resourceRequirements: string;
  scopeDeliverables: string[];
  keyDatesMilestones: IProjectMilestone[];
  threats: string[];
  opportunities: string[];
  keyAssumptions: string[];
  successCriteria: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  lastModifiedBy?: string;
}

const ProjectMilestoneSchema = new Schema({
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  }
});

const ProjectSchema = new Schema<IProject>({
  projectId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^PRO-\d{3}$/,
    description: 'Unique identifier in format PRO-XXX'
  },
  projectName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  sponsor: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  projectTeam: {
    type: [String],
    default: [],
    description: 'Array of team member names'
  },
  keyStakeholders: {
    type: [String],
    default: [],
    description: 'Array of stakeholder names'
  },
  projectObjectives: {
    type: [String],
    default: [],
    description: 'Array of project objectives'
  },
  businessCaseSummary: {
    type: String,
    required: true,
    description: 'Summary of the business case'
  },
  resourceRequirements: {
    type: String,
    required: true,
    description: 'Free text description of resource requirements'
  },
  scopeDeliverables: {
    type: [String],
    default: [],
    description: 'Array of project deliverables'
  },
  keyDatesMilestones: {
    type: [ProjectMilestoneSchema],
    default: [],
    description: 'Array of key dates and milestones'
  },
  threats: {
    type: [String],
    default: [],
    description: 'Array of project threats/risks'
  },
  opportunities: {
    type: [String],
    default: [],
    description: 'Array of project opportunities'
  },
  keyAssumptions: {
    type: [String],
    default: [],
    description: 'Array of key project assumptions'
  },
  successCriteria: {
    type: [String],
    default: [],
    description: 'Array of success criteria'
  },
  isActive: {
    type: Boolean,
    default: true,
    description: 'Whether this project is currently active'
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
  collection: 'projects'
});

// Indexes for efficient querying
ProjectSchema.index({ projectName: 'text' });
ProjectSchema.index({ sponsor: 1 });
ProjectSchema.index({ isActive: 1 });

// Static method to get the next project ID
ProjectSchema.statics.getNextProjectId = async function() {
  const lastProject = await this.findOne()
    .sort({ projectId: -1 })
    .select('projectId');
  
  if (!lastProject) {
    return 'PRO-001';
  }
  
  const lastNumber = parseInt(lastProject.projectId.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `PRO-${nextNumber.toString().padStart(3, '0')}`;
};

// Static method to get active projects
ProjectSchema.statics.getActiveProjects = function() {
  return this.find({ isActive: true }).sort({ projectId: 1 });
};

// Instance method to create a summary
ProjectSchema.methods.getSummary = function() {
  return {
    projectId: this.projectId,
    projectName: this.projectName,
    sponsor: this.sponsor,
    teamSize: this.projectTeam.length,
    deliverableCount: this.scopeDeliverables.length,
    nextMilestone: this.keyDatesMilestones
      .filter(m => m.date > new Date())
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] || null
  };
};

const Project = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;