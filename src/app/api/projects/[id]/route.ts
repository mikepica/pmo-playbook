import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Project from '@/models/Project';

// GET specific project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const projectId = params.id;
    const project = await Project.findOne({ projectId, isActive: true });
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      project: {
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
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const projectId = params.id;
    const updates = await request.json();
    
    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.projectId;
    delete updates.createdAt;
    
    // Update lastModifiedBy timestamp
    updates.lastModifiedBy = 'admin';
    
    const project = await Project.findOneAndUpdate(
      { projectId },
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      message: 'Project updated successfully',
      project: {
        _id: project._id,
        projectId: project.projectId,
        projectName: project.projectName
      }
    });
  } catch (error: any) {
    console.error('Failed to update project:', error);
    return NextResponse.json({ 
      error: 'Failed to update project',
      details: error.message 
    }, { status: 500 });
  }
}

// DELETE project (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const projectId = params.id;
    
    const project = await Project.findOneAndUpdate(
      { projectId },
      { 
        $set: { 
          isActive: false,
          lastModifiedBy: 'admin'
        } 
      },
      { new: true }
    );
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      message: 'Project deleted successfully',
      projectId: project.projectId
    });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}