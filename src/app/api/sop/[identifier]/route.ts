import { NextResponse } from 'next/server';
import { HumanSOP } from '@/models/HumanSOP';

export async function GET(
  request: Request,
  { params }: { params: { identifier: string } }
) {
  const { identifier } = params;
  
  if (!identifier) {
    return NextResponse.json({ error: 'SOP identifier is required' }, { status: 400 });
  }
  
  try {
    // Try to find SOP by slug or ID
    const sop = await HumanSOP.findBySopIdOrSlug(identifier);
    
    if (!sop) {
      return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      id: sop.sopId,
      slug: sop.slug,
      title: sop.data.title,
      content: sop.data.markdownContent,
      version: sop.version,
      createdBy: sop.data.createdBy,
      lastModifiedBy: sop.data.lastModifiedBy,
      createdAt: sop.createdAt,
      updatedAt: sop.updatedAt
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch SOP' }, { status: 500 });
  }
}