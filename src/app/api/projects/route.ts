import { NextResponse } from 'next/server';
import { Project } from '@/models/Project';

// GET all projects
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';
    
    const projects = activeOnly 
      ? await Project.getActiveProjects()
      : await Project.getAllProjects();
    
    return NextResponse.json({ 
      projects: projects.map(project => ({
        _id: project.id.toString(),
        projectId: project.projectId,
        projectName: project.data.projectName,
        sponsor: project.data.sponsor,
        projectTeam: project.data.projectTeam,
        keyStakeholders: project.data.keyStakeholders,
        projectObjectives: project.data.projectObjectives,
        businessCaseSummary: project.data.businessCaseSummary,
        resourceRequirements: project.data.resourceRequirements,
        scopeDeliverables: project.data.scopeDeliverables,
        keyDatesMilestones: project.data.keyDatesMilestones,
        threats: project.data.threats,
        opportunities: project.data.opportunities,
        keyAssumptions: project.data.keyAssumptions,
        successCriteria: project.data.successCriteria,
        isActive: project.isActive,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }))
    });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST create new project
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    const requiredFields = ['projectName', 'sponsor', 'businessCaseSummary', 'resourceRequirements'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json({ 
          error: `Missing required field: ${field}` 
        }, { status: 400 });
      }
    }
    
    // Ensure arrays are properly formatted
    const arrayFields = [
      'projectTeam', 'keyStakeholders', 'projectObjectives', 
      'scopeDeliverables', 'keyDatesMilestones', 'threats', 
      'opportunities', 'keyAssumptions', 'successCriteria'
    ];
    
    for (const field of arrayFields) {
      if (data[field] && !Array.isArray(data[field])) {
        data[field] = [];
      }
    }
    
    // Generate next project ID if not provided
    const projectId = data.projectId || await Project.getNextProjectId();
    
    // Remove projectId from data as it's stored separately
    const { projectId: _, ...projectData } = data;
    
    const project = await Project.createProject(projectId, projectData);
    
    return NextResponse.json({ 
      message: 'Project created successfully',
      project: {
        _id: project.id.toString(),
        projectId: project.projectId,
        projectName: project.data.projectName
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ 
        error: 'Project ID already exists' 
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to create project',
      details: (error as Error).message 
    }, { status: 500 });
  }
}