import { NextResponse } from 'next/server';
import { HumanSOP } from '@/models/HumanSOP';
import { AgentSOP } from '@/models/AgentSOP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  
  try {
    if (type === 'markdown' || type === 'all') {
      const sops = await HumanSOP.getAllActiveSOPs();
      const sopList = sops.map(sop => ({
        id: sop.sopId,
        filename: `${sop.sopId} - ${sop.data.title}`,
        title: sop.data.title,
        phase: sop.phase
      }));
      
      return NextResponse.json({ 
        files: sopList.map(s => s.filename), // For backward compatibility
        sops: sopList // Full SOP info
      });
    } else if (type === 'agent') {
      const summaries = await AgentSOP.getAllSummaries();
      
      return NextResponse.json({ 
        sops: summaries.map(sop => ({
          id: sop.sopId,
          title: sop.title,
          phase: sop.phase,
          summary: sop.summary,
          keywords: sop.keywords
        }))
      });
    }
    
    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch SOPs' }, { status: 500 });
  }
}