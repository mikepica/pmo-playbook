import { NextResponse } from 'next/server';
import { HumanSOP } from '@/models/HumanSOP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sopId = searchParams.get('sopId');
  const slug = searchParams.get('slug');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _type = searchParams.get('type') || 'human'; // Only 'human' supported now
  const all = searchParams.get('all'); // Get all SOPs
  
  try {
    
    // If requesting all SOPs
    if (all === 'true') {
      const pgSops = await HumanSOP.getAllActiveSOPs();
      const sops = pgSops.map(sop => ({
        _id: sop.id.toString(),
        sopId: sop.sopId,
        slug: sop.slug,
        title: sop.data.title,
        version: sop.version,
        markdownContent: sop.data.markdownContent,
        updatedAt: sop.updatedAt
      }));
      
      return NextResponse.json({ sops });
    }
    
    if (!sopId && !slug) {
      return NextResponse.json({ error: 'Missing sopId or slug parameter' }, { status: 400 });
    }
    
    // Try to find by slug first, then by sopId for backward compatibility
    let sop;
    if (slug) {
      sop = await HumanSOP.findBySlug(slug);
    } else if (sopId) {
      sop = await HumanSOP.findBySopId(sopId);
    }
    
    if (sop) {
      return NextResponse.json({ 
        content: sop.data.markdownContent,
        title: sop.data.title,
        version: sop.version,
        updatedAt: sop.updatedAt
      });
    }
    return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch SOP content' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { sopId, markdownContent, type } = body;
    
    if (!sopId || !markdownContent || type !== 'human') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Find the SOP first to increment version
    const existingSOP = await HumanSOP.findBySopId(sopId);
    
    if (!existingSOP) {
      return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
    }
    
    // Update the HumanSOP with version increment
    const updatedData = {
      ...existingSOP.data,
      markdownContent,
      title: existingSOP.data.title,
      lastModifiedBy: 'admin' // TODO: Get from auth context
    };
    
    const newVersion = (existingSOP.version || 1) + 1;
    await HumanSOP.updateById(existingSOP.id, updatedData, newVersion);
    
    // Get the updated SOP for response
    const updatedSOP = await HumanSOP.findBySopId(sopId);
    
    return NextResponse.json({ 
      success: true,
      sop: {
        sopId: updatedSOP?.sopId,
        title: updatedSOP?.data.title,
        version: updatedSOP?.version,
        updatedAt: updatedSOP?.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Failed to update SOP' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, markdownContent } = body;
    
    if (!title || !markdownContent) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }
    
    // Generate next available SOP ID
    const sopId = await HumanSOP.getNextSopId();
    
    // Create the HumanSOP data
    const sopData = {
      title: title.trim(),
      markdownContent: markdownContent.trim(),
      createdBy: 'admin', // TODO: Get from auth context
      lastModifiedBy: 'admin'
    };
    
    // Create the HumanSOP
    const newSOP = await HumanSOP.createSOP(sopId, sopData);
    
    return NextResponse.json({ 
      success: true,
      sop: {
        _id: newSOP.id.toString(),
        sopId: newSOP.sopId,
        title: newSOP.data.title,
        version: newSOP.version,
        markdownContent: newSOP.data.markdownContent,
        updatedAt: newSOP.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Create SOP error:', error);
    return NextResponse.json({ error: 'Failed to create SOP' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sopId = searchParams.get('sopId');
    
    if (!sopId) {
      return NextResponse.json({ error: 'Missing sopId parameter' }, { status: 400 });
    }
    
    // Find the HumanSOP first to verify it exists
    const humanSOP = await HumanSOP.findBySopId(sopId);
    
    if (!humanSOP) {
      return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
    }
    
    // Delete the HumanSOP
    await HumanSOP.delete({ sop_id: sopId });
    
    return NextResponse.json({ 
      success: true,
      message: `SOP ${sopId} deleted successfully`
    });
    
  } catch (error) {
    console.error('Delete SOP error:', error);
    return NextResponse.json({ error: 'Failed to delete SOP' }, { status: 500 });
  }
}