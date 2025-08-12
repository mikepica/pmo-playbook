import { NextResponse } from 'next/server';
import { HumanSOP } from '@/models/HumanSOP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  
  try {
    const sops = await HumanSOP.getAllActiveSOPs();
    const sopList = sops.map(sop => ({
      id: sop.sopId,
      filename: `${sop.sopId} - ${sop.data.title}`,
      title: sop.data.title
    }));
    
    return NextResponse.json({ 
      files: sopList.map(s => s.filename), // For backward compatibility
      sops: sopList // Full SOP info
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch SOPs' }, { status: 500 });
  }
}