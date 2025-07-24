import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { regenerateAgentSOP, regenerateAllAgentSOPs } from '@/lib/sop-regenerator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sopId, regenerateAll } = body;
    
    await connectToDatabase();
    
    if (regenerateAll) {
      // Regenerate all AgentSOPs
      const results = await regenerateAllAgentSOPs();
      
      return NextResponse.json({
        success: true,
        message: `Regenerated ${results.successful} out of ${results.totalProcessed} SOPs`,
        details: {
          totalProcessed: results.totalProcessed,
          successful: results.successful,
          failed: results.failed,
          results: results.results
        }
      });
    } else if (sopId) {
      // Regenerate single AgentSOP
      const result = await regenerateAgentSOP(sopId);
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
        errors: result.errors,
        warnings: result.warnings,
        agentSOPVersion: result.agentSOP?.version
      });
    } else {
      return NextResponse.json(
        { error: 'Missing sopId or regenerateAll parameter' }, 
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Regeneration error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate AgentSOP(s)' }, 
      { status: 500 }
    );
  }
}