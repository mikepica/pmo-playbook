import { NextResponse } from 'next/server';
import { HumanSOP } from '@/models/HumanSOP';
import { AgentSOP } from '@/models/AgentSOP';
import { regenerateAgentSOP } from '@/lib/sop-regenerator';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sopId = searchParams.get('sopId');
  const type = searchParams.get('type') || 'human'; // 'human' or 'agent'
  const all = searchParams.get('all'); // Get all SOPs
  
  try {
    
    // If requesting all SOPs
    if (all === 'true') {
      if (type === 'human') {
        const pgSops = await HumanSOP.getAllActiveSOPs();
        const sops = pgSops.map(sop => ({
          _id: sop.id.toString(),
          sopId: sop.sopId,
          title: sop.data.title,
          phase: sop.phase,
          version: sop.version,
          markdownContent: sop.data.markdownContent,
          updatedAt: sop.updatedAt
        }));
        
        return NextResponse.json({ sops });
      }
      // Could add agent SOP listing here if needed
      return NextResponse.json({ error: 'Agent SOP listing not implemented' }, { status: 400 });
    }
    
    if (!sopId) {
      return NextResponse.json({ error: 'Missing sopId parameter' }, { status: 400 });
    }
    
    if (type === 'human') {
      const sop = await HumanSOP.findBySopId(sopId);
      if (sop) {
        return NextResponse.json({ 
          content: sop.data.markdownContent,
          title: sop.data.title,
          phase: sop.phase,
          version: sop.version,
          updatedAt: sop.updatedAt
        });
      }
      return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
    } else if (type === 'agent') {
      const sop = await AgentSOP.findBySopId(sopId);
      if (sop) {
        return NextResponse.json({ 
          content: AgentSOP.generateAIContext(sop),
          title: sop.data.title,
          phase: sop.phase,
          summary: sop.data.summary
        });
      }
      return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
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
    await HumanSOP.updateById(existingSOP.id, updatedData, newVersion, existingSOP.phase);
    
    // Get the updated SOP for response
    const updatedSOP = await HumanSOP.findBySopId(sopId);
    
    // Regenerate AgentSOP
    const regenerationResult = await regenerateAgentSOP(sopId);
    
    if (!regenerationResult.success) {
      console.error('Failed to regenerate AgentSOP:', regenerationResult.message);
      
      // Still return success for HumanSOP update, but include warning
      return NextResponse.json({ 
        success: true,
        sop: {
          sopId: updatedSOP?.sopId,
          title: updatedSOP?.data.title,
          version: updatedSOP?.version,
          updatedAt: updatedSOP?.updatedAt
        },
        warning: `SOP updated but AgentSOP regeneration failed: ${regenerationResult.message}`,
        regenerationErrors: regenerationResult.errors,
        regenerationWarnings: regenerationResult.warnings
      });
    }
    
    return NextResponse.json({ 
      success: true,
      sop: {
        sopId: updatedSOP?.sopId,
        title: updatedSOP?.data.title,
        version: updatedSOP?.version,
        updatedAt: updatedSOP?.updatedAt
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