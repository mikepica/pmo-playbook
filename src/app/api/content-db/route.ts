import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import HumanSOP from '@/models/HumanSOP';
import AgentSOP from '@/models/AgentSOP';
import { regenerateAgentSOP } from '@/lib/sop-regenerator';

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
    
    // Find the SOP first to increment version
    const existingSOP = await HumanSOP.findOne({ sopId, isActive: true });
    
    if (!existingSOP) {
      return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
    }
    
    // Update the HumanSOP with version increment
    existingSOP.markdownContent = markdownContent;
    existingSOP.version = (existingSOP.version || 1) + 1;
    existingSOP.lastModifiedBy = 'admin'; // TODO: Get from auth context
    
    await existingSOP.save();
    
    // Regenerate AgentSOP
    const regenerationResult = await regenerateAgentSOP(sopId);
    
    if (!regenerationResult.success) {
      console.error('Failed to regenerate AgentSOP:', regenerationResult.message);
      
      // Still return success for HumanSOP update, but include warning
      return NextResponse.json({ 
        success: true,
        sop: {
          sopId: existingSOP.sopId,
          title: existingSOP.title,
          version: existingSOP.version,
          updatedAt: existingSOP.updatedAt
        },
        warning: `SOP updated but AgentSOP regeneration failed: ${regenerationResult.message}`,
        regenerationErrors: regenerationResult.errors,
        regenerationWarnings: regenerationResult.warnings
      });
    }
    
    return NextResponse.json({ 
      success: true,
      sop: {
        sopId: existingSOP.sopId,
        title: existingSOP.title,
        version: existingSOP.version,
        updatedAt: existingSOP.updatedAt
      },
      agentSOPRegenerated: true,
      agentSOPVersion: regenerationResult.agentSOP?.version,
      regenerationWarnings: regenerationResult.warnings
    });
    
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Failed to update SOP' }, { status: 500 });
  }
}