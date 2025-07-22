import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import HumanSOP from '@/models/HumanSOP';
import AgentSOP from '@/models/AgentSOP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sopId = searchParams.get('sopId');
  const type = searchParams.get('type') || 'human'; // 'human' or 'agent'
  
  if (!sopId) {
    return NextResponse.json({ error: 'Missing sopId parameter' }, { status: 400 });
  }
  
  try {
    await connectToDatabase();
    
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