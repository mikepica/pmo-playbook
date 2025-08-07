import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import MongoProject from '@/models/Project';
import { Project as PostgresProject } from '@/models/postgres/Project';
import { DATABASE_CONFIG } from '@/lib/database-config';

// GET all projects
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';
    
    if (DATABASE_CONFIG.projects === 'postgres') {
      // Use PostgreSQL
      const projects = activeOnly 
        ? await PostgresProject.getActiveProjects()
        : await PostgresProject.getAllProjects();
      
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
    } else {
      // Use MongoDB (existing logic)
      await connectToDatabase();
      
      const query = activeOnly ? { isActive: true } : {};
      const projects = await MongoProject.find(query)
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
    }
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
    
    if (DATABASE_CONFIG.projects === 'postgres') {
      // Use PostgreSQL
      // Generate next project ID if not provided
      const projectId = data.projectId || await PostgresProject.getNextProjectId();
      
      // Remove projectId from data as it's stored separately
      const { projectId: _, ...projectData } = data;
      
      const project = await PostgresProject.createProject(projectId, projectData);
      
      return NextResponse.json({ 
        message: 'Project created successfully',
        project: {
          _id: project.id.toString(),
          projectId: project.projectId,
          projectName: project.data.projectName
        }
      }, { status: 201 });
    } else {
      // Use MongoDB (existing logic)
      await connectToDatabase();
      
      // Generate next project ID if not provided
      if (!data.projectId) {
        data.projectId = await MongoProject.getNextProjectId();
      }
      
      // Create new project
      const project = new MongoProject(data);
      await project.save();
      
      return NextResponse.json({ 
        message: 'Project created successfully',
        project: {
          _id: project._id,
          projectId: project.projectId,
          projectName: project.projectName
        }
      }, { status: 201 });
    }
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