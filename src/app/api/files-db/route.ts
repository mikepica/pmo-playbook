import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import HumanSOP from '@/models/HumanSOP';
import AgentSOP from '@/models/AgentSOP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  
  try {
    await connectToDatabase();
    
    if (type === 'markdown' || type === 'all') {
      // Get all active HumanSOPs
      const sops = await HumanSOP.find({ isActive: true })
        .sort({ phase: 1 })
        .select('sopId title phase');
      
      const sopList = sops.map(sop => ({
        id: sop.sopId,
        filename: `${sop.sopId} - ${sop.title}`, // Simulated filename format
        title: sop.title,
        phase: sop.phase
      }));
      
      return NextResponse.json({ 
        files: sopList.map(s => s.filename), // For backward compatibility
        sops: sopList // Full SOP info
      });
    } else if (type === 'agent') {
      // Get all active AgentSOPs with summaries
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