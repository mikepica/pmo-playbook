import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import HumanSOP from '@/models/HumanSOP';
import AgentSOP from '@/models/AgentSOP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sopId = searchParams.get('sopId');
  const type = searchParams.get('type') || 'human'; // 'human' or 'agent'
  const all = searchParams.get('all'); // Get all SOPs
  
  try {
    await connectToDatabase();
    
    // If requesting all SOPs
    if (all === 'true') {
      if (type === 'human') {
        const sops = await HumanSOP.find({ isActive: true })
          .select('sopId title phase version markdownContent updatedAt')
          .sort({ phase: 1 });
        
        return NextResponse.json({ 
          sops: sops.map(sop => ({
            _id: sop._id,
            sopId: sop.sopId,
            title: sop.title,
            phase: sop.phase,
            version: sop.version,
            markdownContent: sop.markdownContent,
            updatedAt: sop.updatedAt
          }))
        });
      }
      // Could add agent SOP listing here if needed
      return NextResponse.json({ error: 'Agent SOP listing not implemented' }, { status: 400 });
    }
    
    if (!sopId) {
      return NextResponse.json({ error: 'Missing sopId parameter' }, { status: 400 });
    }
    
    if (type === 'human') {
      const sop = await HumanSOP.findOne({ sopId, isActive: true });
      
      if (!sop) {
        return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
      }
      
      return NextResponse.json({ 
        content: sop.markdownContent,
        title: sop.title,
        phase: sop.phase,
        version: sop.version,
        updatedAt: sop.updatedAt
      });
    } else if (type === 'agent') {
      const sop = await AgentSOP.findOne({ sopId, isActive: true });
      
      if (!sop) {
        return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
      }
      
      return NextResponse.json({ 
        content: sop.generateAIContext(),
        title: sop.title,
        phase: sop.phase,
        summary: sop.summary
      });
    }
    
    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
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
    
    await connectToDatabase();
    
    // Update the HumanSOP
    const updatedSOP = await HumanSOP.findOneAndUpdate(
      { sopId, isActive: true },
      { 
        markdownContent,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updatedSOP) {
      return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
    }
    
    // TODO: Regenerate AgentSOP here
    // This would involve parsing the markdown and updating the corresponding AgentSOP
    console.log('Should regenerate AgentSOP for:', sopId);
    
    return NextResponse.json({ 
      success: true,
      sop: {
        sopId: updatedSOP.sopId,
        title: updatedSOP.title,
        version: updatedSOP.version,
        updatedAt: updatedSOP.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Failed to update SOP' }, { status: 500 });
  }
}