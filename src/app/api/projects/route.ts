import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Project from '@/models/Project';

// GET all projects
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';
    
    await connectToDatabase();
    
    const query = activeOnly ? { isActive: true } : {};
    const projects = await Project.find(query)
      .sort({ projectId: 1 })
      .select('-__v');
    
    return NextResponse.json({ 
      projects: projects.map(project => ({
        _id: project._id,
        projectId: project.projectId,
        projectName: project.projectName,
        sponsor: project.sponsor,
        projectTeam: project.projectTeam,
        keyStakeholders: project.keyStakeholders,
        projectObjectives: project.projectObjectives,
        businessCaseSummary: project.businessCaseSummary,
        resourceRequirements: project.resourceRequirements,
        scopeDeliverables: project.scopeDeliverables,
        keyDatesMilestones: project.keyDatesMilestones,
        threats: project.threats,
        opportunities: project.opportunities,
        keyAssumptions: project.keyAssumptions,
        successCriteria: project.successCriteria,
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
    await connectToDatabase();
    
    const data = await request.json();
    
    // Generate next project ID if not provided
    if (!data.projectId) {
      data.projectId = await Project.getNextProjectId();
    }
    
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
    
    // Create new project
    const project = new Project(data);
    await project.save();
    
    return NextResponse.json({ 
      message: 'Project created successfully',
      project: {
        _id: project._id,
        projectId: project.projectId,
        projectName: project.projectName
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create project:', error);
    
    if (error.code === 11000) {
      return NextResponse.json({ 
        error: 'Project ID already exists' 
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to create project',
      details: error.message 
    }, { status: 500 });
  }
}