'use client';

import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import SOPTabs from '@/components/SOPTabs';
import ChatInterfaceAI from '@/components/ChatInterfaceAI';
import { 
  Calendar, Users, Target, Briefcase, 
  AlertTriangle, TrendingUp, CheckSquare, 
  FileText, User, Package, Clock,
  Activity
} from 'lucide-react';

interface ProjectMilestone {
  date: string;
  description: string;
}

interface Project {
  _id: string;
  projectId: string;
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
  createdAt: string;
  updatedAt: string;
}

interface ProjectCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function ProjectCard({ title, icon, children, className = '' }: ProjectCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center mb-4">
        <div className="text-blue-600 mr-3">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`/api/projects/${projectId}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          notFound();
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setProject(data.project);
    } catch (error) {
      console.error('Failed to fetch project:', error);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="animate-pulse flex space-x-4">
            <div className="h-10 bg-gray-200 rounded w-32"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading project...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h1>
          <p className="text-gray-600">The project you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <SOPTabs
        selectedSOP={null}
        onSOPSelect={() => {}}
        onSOPsLoaded={() => {}}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Project Details */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.projectName}</h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                <Briefcase className="w-4 h-4 mr-1" />
                {project.projectId}
              </span>
              <span className="flex items-center">
                <User className="w-4 h-4 mr-1" />
                Sponsor: {project.sponsor}
              </span>
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                Updated: {new Date(project.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Project Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Business Case Summary */}
            <ProjectCard 
              title="Business Case Summary" 
              icon={<FileText className="w-5 h-5" />}
              className="lg:col-span-2"
            >
              <p className="whitespace-pre-wrap">{project.businessCaseSummary}</p>
            </ProjectCard>

            {/* Project Objectives */}
            <ProjectCard title="Project Objectives" icon={<Target className="w-5 h-5" />}>
              {project.projectObjectives.length === 0 ? (
                <p className="text-gray-500 italic">No objectives defined</p>
              ) : (
                <ul className="space-y-2">
                  {project.projectObjectives.map((objective, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ProjectCard>

            {/* Success Criteria */}
            <ProjectCard title="Success Criteria" icon={<CheckSquare className="w-5 h-5" />}>
              {project.successCriteria.length === 0 ? (
                <p className="text-gray-500 italic">No success criteria defined</p>
              ) : (
                <ul className="space-y-2">
                  {project.successCriteria.map((criteria, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span>{criteria}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ProjectCard>

            {/* Project Team */}
            <ProjectCard title="Project Team" icon={<Users className="w-5 h-5" />}>
              {project.projectTeam.length === 0 ? (
                <p className="text-gray-500 italic">No team members defined</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {project.projectTeam.map((member, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      {member}
                    </span>
                  ))}
                </div>
              )}
            </ProjectCard>

            {/* Key Stakeholders */}
            <ProjectCard title="Key Stakeholders" icon={<Activity className="w-5 h-5" />}>
              {project.keyStakeholders.length === 0 ? (
                <p className="text-gray-500 italic">No stakeholders defined</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {project.keyStakeholders.map((stakeholder, index) => (
                    <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      {stakeholder}
                    </span>
                  ))}
                </div>
              )}
            </ProjectCard>

            {/* Resource Requirements */}
            <ProjectCard 
              title="Resource Requirements" 
              icon={<Package className="w-5 h-5" />}
              className="lg:col-span-2"
            >
              <p className="whitespace-pre-wrap">{project.resourceRequirements}</p>
            </ProjectCard>

            {/* Scope & Deliverables */}
            <ProjectCard title="Scope & Deliverables" icon={<FileText className="w-5 h-5" />}>
              {project.scopeDeliverables.length === 0 ? (
                <p className="text-gray-500 italic">No deliverables defined</p>
              ) : (
                <ul className="space-y-2">
                  {project.scopeDeliverables.map((deliverable, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-indigo-600 mr-2">→</span>
                      <span>{deliverable}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ProjectCard>

            {/* Key Dates & Milestones */}
            <ProjectCard title="Key Dates & Milestones" icon={<Calendar className="w-5 h-5" />}>
              {project.keyDatesMilestones.length === 0 ? (
                <p className="text-gray-500 italic">No milestones defined</p>
              ) : (
                <div className="space-y-3">
                  {project.keyDatesMilestones.map((milestone, index) => (
                    <div key={index} className="flex items-start">
                      <div className="min-w-[100px] text-sm text-gray-600">
                        {new Date(milestone.date).toLocaleDateString()}
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="text-sm">{milestone.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ProjectCard>

            {/* Threats & Opportunities */}
            <ProjectCard 
              title="Threats & Opportunities" 
              icon={<AlertTriangle className="w-5 h-5" />}
              className="lg:col-span-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-red-700 mb-2">Threats</h4>
                  {project.threats.length === 0 ? (
                    <p className="text-gray-500 italic">No threats identified</p>
                  ) : (
                    <ul className="space-y-2">
                      {project.threats.map((threat, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-red-600 mr-2">⚠</span>
                          <span className="text-sm">{threat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-green-700 mb-2">Opportunities</h4>
                  {project.opportunities.length === 0 ? (
                    <p className="text-gray-500 italic">No opportunities identified</p>
                  ) : (
                    <ul className="space-y-2">
                      {project.opportunities.map((opportunity, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-green-600 mr-2">★</span>
                          <span className="text-sm">{opportunity}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </ProjectCard>

            {/* Key Assumptions */}
            <ProjectCard 
              title="Key Assumptions" 
              icon={<TrendingUp className="w-5 h-5" />}
              className="lg:col-span-2"
            >
              {project.keyAssumptions.length === 0 ? (
                <p className="text-gray-500 italic">No assumptions defined</p>
              ) : (
                <ul className="space-y-2">
                  {project.keyAssumptions.map((assumption, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-orange-600 mr-2">◆</span>
                      <span>{assumption}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ProjectCard>
          </div>
        </div>
        
        {/* AI Chat Interface - Persistent across all pages */}
        <div className="w-[1000px] flex flex-col border-l border-gray-300 overflow-hidden h-full">
          <ChatInterfaceAI />
        </div>
      </div>
    </div>
  );
}