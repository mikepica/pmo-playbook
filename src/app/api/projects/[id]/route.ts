import { NextResponse } from 'next/server';
import { Project } from '@/models/Project';

// GET specific project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Database connection handled by model
    
    const { id: projectId } = await params;
    const project = await Project.findByProjectId(projectId);
    
    if (!project || !project.isActive) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      project: {
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
      }
    });
  } catch (error) {
    console.error('Failed to fetch project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PUT update project
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Database connection handled by model
    
    const { id: projectId } = await params;
    const updates = await request.json();
    
    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.projectId;
    delete updates.createdAt;
    
    // Find existing project
    const existingProject = await Project.findByProjectId(projectId);
    if (!existingProject || !existingProject.isActive) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // Merge updates with existing data
    const updatedData = {
      ...existingProject.data,
      ...updates,
      lastModifiedBy: 'admin'
    };
    
    // Update the project
    await Project.update(existingProject.id, updatedData, existingProject.phase);
    
    // Get the updated project
    const updatedProject = await Project.findByProjectId(projectId);
    
    return NextResponse.json({ 
      message: 'Project updated successfully',
      project: {
        _id: updatedProject?.id.toString(),
        projectId: updatedProject?.projectId,
        projectName: updatedProject?.data.projectName
      }
    });
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json({ 
      error: 'Failed to update project',
      details: (error as Error).message 
    }, { status: 500 });
  }
}

// DELETE project (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Database connection handled by model
    
    const { id: projectId } = await params;
    
    // Find existing project
    const existingProject = await Project.findByProjectId(projectId);
    if (!existingProject || !existingProject.isActive) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // Soft delete by setting isActive to false
    const updatedData = {
      ...existingProject.data,
      lastModifiedBy: 'admin'
    };
    
    await Project.update(existingProject.id, updatedData, existingProject.phase, false);
    
    return NextResponse.json({ 
      message: 'Project deleted successfully',
      projectId
    });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}