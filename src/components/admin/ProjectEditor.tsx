'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar } from 'lucide-react';

interface ProjectMilestone {
  date: string;
  description: string;
}

interface ProjectData {
  projectId?: string;
  projectName: string;
  sponsor: string;
  projectTeam: string[];
  keyStakeholders: string[];
  projectObjectives: string[];
  businessCaseSummary: string;
  resourceRequirements: string;
  scopeDeliverables: string[];
  keyDatesMilestones: ProjectMilestone[];
  threats: string[];
  opportunities: string[];
  keyAssumptions: string[];
  successCriteria: string[];
  isActive: boolean;
}

interface ProjectEditorProps {
  project: ProjectData | null;
  onSave: (data: ProjectData) => void;
  onCancel: () => void;
}

export default function ProjectEditor({ project, onSave, onCancel }: ProjectEditorProps) {
  const [formData, setFormData] = useState<ProjectData>({
    projectName: '',
    sponsor: '',
    projectTeam: [],
    keyStakeholders: [],
    projectObjectives: [],
    businessCaseSummary: '',
    resourceRequirements: '',
    scopeDeliverables: [],
    keyDatesMilestones: [],
    threats: [],
    opportunities: [],
    keyAssumptions: [],
    successCriteria: [],
    isActive: true
  });

  const [inputValues, setInputValues] = useState({
    projectTeam: '',
    keyStakeholders: '',
    projectObjectives: '',
    scopeDeliverables: '',
    threats: '',
    opportunities: '',
    keyAssumptions: '',
    successCriteria: '',
    milestoneDate: '',
    milestoneDescription: ''
  });

  useEffect(() => {
    if (project) {
      setFormData({
        ...project,
        keyDatesMilestones: project.keyDatesMilestones || []
      });
    }
  }, [project]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayAdd = (field: keyof typeof inputValues) => {
    const value = inputValues[field].trim();
    if (!value) return;

    const arrayField = field as keyof ProjectData;
    setFormData(prev => ({
      ...prev,
      [arrayField]: [...(prev[arrayField] as string[]), value]
    }));
    
    setInputValues(prev => ({
      ...prev,
      [field]: ''
    }));
  };

  const handleArrayRemove = (field: keyof ProjectData, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }));
  };

  const handleMilestoneAdd = () => {
    if (!inputValues.milestoneDate || !inputValues.milestoneDescription.trim()) return;

    setFormData(prev => ({
      ...prev,
      keyDatesMilestones: [...prev.keyDatesMilestones, {
        date: inputValues.milestoneDate,
        description: inputValues.milestoneDescription.trim()
      }]
    }));

    setInputValues(prev => ({
      ...prev,
      milestoneDate: '',
      milestoneDescription: ''
    }));
  };

  const handleMilestoneRemove = (index: number) => {
    setFormData(prev => ({
      ...prev,
      keyDatesMilestones: prev.keyDatesMilestones.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const renderArrayInput = (
    field: keyof typeof inputValues,
    label: string,
    placeholder: string
  ) => {
    const arrayField = field as keyof ProjectData;
    const items = formData[arrayField] as string[];

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="mt-1">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValues[field]}
              onChange={(e) => setInputValues(prev => ({ ...prev, [field]: e.target.value }))}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayAdd(field))}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => handleArrayAdd(field)}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {items.length > 0 && (
            <div className="mt-2 space-y-1">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded">
                  <span className="flex-1 text-sm">{item}</span>
                  <button
                    type="button"
                    onClick={() => handleArrayRemove(arrayField, index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {project ? 'Edit Project' : 'Create New Project'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => handleInputChange('projectName', e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Sponsor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.sponsor}
                  onChange={(e) => handleInputChange('sponsor', e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Business Case Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Business Case Summary <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.businessCaseSummary}
                onChange={(e) => handleInputChange('businessCaseSummary', e.target.value)}
                required
                rows={4}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Resource Requirements */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Resource Requirements <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.resourceRequirements}
                onChange={(e) => handleInputChange('resourceRequirements', e.target.value)}
                required
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Array Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderArrayInput('projectTeam', 'Project Team', 'Add team member')}
              {renderArrayInput('keyStakeholders', 'Key Stakeholders', 'Add stakeholder')}
              {renderArrayInput('projectObjectives', 'Project Objectives', 'Add objective')}
              {renderArrayInput('scopeDeliverables', 'Scope & Deliverables', 'Add deliverable')}
              {renderArrayInput('threats', 'Threats', 'Add threat')}
              {renderArrayInput('opportunities', 'Opportunities', 'Add opportunity')}
              {renderArrayInput('keyAssumptions', 'Key Assumptions', 'Add assumption')}
              {renderArrayInput('successCriteria', 'Success Criteria', 'Add criteria')}
            </div>

            {/* Key Dates & Milestones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Key Dates & Milestones
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={inputValues.milestoneDate}
                  onChange={(e) => setInputValues(prev => ({ ...prev, milestoneDate: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={inputValues.milestoneDescription}
                  onChange={(e) => setInputValues(prev => ({ ...prev, milestoneDescription: e.target.value }))}
                  placeholder="Milestone description"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleMilestoneAdd}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {formData.keyDatesMilestones.length > 0 && (
                <div className="mt-2 space-y-1">
                  {formData.keyDatesMilestones.map((milestone, index) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">
                        {new Date(milestone.date).toLocaleDateString()}
                      </span>
                      <span className="flex-1 text-sm">{milestone.description}</span>
                      <button
                        type="button"
                        onClick={() => handleMilestoneRemove(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Project is active</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {project ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}