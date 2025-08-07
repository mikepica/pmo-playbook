import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import MongoHumanSOP from '@/models/HumanSOP';
import MongoAgentSOP from '@/models/AgentSOP';
import { HumanSOP as PostgresHumanSOP } from '@/models/postgres/HumanSOP';
import { AgentSOP as PostgresAgentSOP } from '@/models/postgres/AgentSOP';
import { DATABASE_CONFIG } from '@/lib/database-config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  
  try {
    if (type === 'markdown' || type === 'all') {
      let sopList;
      
      if (DATABASE_CONFIG.humanSops === 'postgres') {
        // Use PostgreSQL
        const sops = await PostgresHumanSOP.getAllActiveSOPs();
        sopList = sops.map(sop => ({
          id: sop.sopId,
          filename: `${sop.sopId} - ${sop.data.title}`,
          title: sop.data.title,
          phase: sop.phase
        }));
      } else {
        // Use MongoDB
        await connectToDatabase();
        const sops = await MongoHumanSOP.find({ isActive: true })
          .sort({ phase: 1 })
          .select('sopId title phase');
        
        sopList = sops.map(sop => ({
          id: sop.sopId,
          filename: `${sop.sopId} - ${sop.title}`,
          title: sop.title,
          phase: sop.phase
        }));
      }
      
      return NextResponse.json({ 
        files: sopList.map(s => s.filename), // For backward compatibility
        sops: sopList // Full SOP info
      });
    } else if (type === 'agent') {
      let summaries;
      
      if (DATABASE_CONFIG.agentSops === 'postgres') {
        // Use PostgreSQL
        summaries = await PostgresAgentSOP.getAllSummaries();
      } else {
        // Use MongoDB
        await connectToDatabase();
        summaries = await MongoAgentSOP.getAllSummaries();
      }
      
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