import { connectToDatabase } from '@/lib/mongodb';
import HumanSOP from '@/models/HumanSOP';
import AgentSOP from '@/models/AgentSOP';
import SOPVersionHistory from '@/models/SOPVersionHistory';
import { parseSOPMarkdown, validateSOPStructure } from './sop-parser';

interface RegenerationResult {
  success: boolean;
  message: string;
  agentSOP?: {
    sopId: string;
    title: string;
    parsedContent: Record<string, unknown>;
    version: number;
  };
  errors?: string[];
  warnings?: string[];
}

export async function regenerateAgentSOP(sopId: string): Promise<RegenerationResult> {
  try {
    await connectToDatabase();
    
    // Fetch the HumanSOP
    const humanSOP = await HumanSOP.findOne({ sopId, isActive: true });
    
    if (!humanSOP) {
      return {
        success: false,
        message: `HumanSOP with ID ${sopId} not found`
      };
    }
    
    // Parse the markdown content
    const parsedSOP = parseSOPMarkdown(humanSOP.markdownContent, sopId);
    
    // Validate the structure
    const validation = validateSOPStructure(parsedSOP);
    
    if (!validation.isValid) {
      return {
        success: false,
        message: 'SOP validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      };
    }
    
    // Find existing AgentSOP
    const existingAgentSOP = await AgentSOP.findOne({ sopId, isActive: true });
    
    if (existingAgentSOP) {
      // Update existing AgentSOP
      existingAgentSOP.title = parsedSOP.title;
      existingAgentSOP.phase = parsedSOP.phase;
      existingAgentSOP.summary = parsedSOP.summary;
      existingAgentSOP.description = parsedSOP.description;
      existingAgentSOP.sections = parsedSOP.sections;
      existingAgentSOP.keywords = parsedSOP.keywords;
      existingAgentSOP.version = (existingAgentSOP.version || 1) + 1;
      existingAgentSOP.lastSyncedAt = new Date();
      
      await existingAgentSOP.save();
      
      // Track version history
      await SOPVersionHistory.createVersion(
        sopId,
        'agent',
        existingAgentSOP.version,
        existingAgentSOP.toObject(),
        'regenerate',
        'system',
        {
          previousVersion: existingAgentSOP.version - 1,
          regenerationWarnings: validation.warnings
        }
      );
      
      return {
        success: true,
        message: `AgentSOP ${sopId} regenerated successfully (v${existingAgentSOP.version})`,
        agentSOP: existingAgentSOP,
        warnings: validation.warnings
      };
    } else {
      // Create new AgentSOP
      const newAgentSOP = new AgentSOP({
        sopId,
        humanSopId: humanSOP._id,
        title: parsedSOP.title,
        phase: parsedSOP.phase,
        summary: parsedSOP.summary,
        description: parsedSOP.description,
        sections: parsedSOP.sections,
        keywords: parsedSOP.keywords,
        relatedSopIds: getRelatedSOPIds(parsedSOP.phase),
        version: 1,
        isActive: true,
        lastSyncedAt: new Date()
      });
      
      await newAgentSOP.save();
      
      // Track version history
      await SOPVersionHistory.createVersion(
        sopId,
        'agent',
        1,
        newAgentSOP.toObject(),
        'create',
        'system',
        {
          regenerationWarnings: validation.warnings
        }
      );
      
      return {
        success: true,
        message: `AgentSOP ${sopId} created successfully`,
        agentSOP: newAgentSOP,
        warnings: validation.warnings
      };
    }
  } catch (error) {
    console.error('Error regenerating AgentSOP:', error);
    return {
      success: false,
      message: `Failed to regenerate AgentSOP: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function regenerateAllAgentSOPs(): Promise<{
  totalProcessed: number;
  successful: number;
  failed: number;
  results: RegenerationResult[];
}> {
  try {
    await connectToDatabase();
    
    // Get all active HumanSOPs
    const humanSOPs = await HumanSOP.find({ isActive: true });
    
    const results: RegenerationResult[] = [];
    let successful = 0;
    let failed = 0;
    
    for (const humanSOP of humanSOPs) {
      const result = await regenerateAgentSOP(humanSOP.sopId);
      results.push(result);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }
    
    return {
      totalProcessed: humanSOPs.length,
      successful,
      failed,
      results
    };
  } catch (error) {
    console.error('Error regenerating all AgentSOPs:', error);
    throw error;
  }
}

// Helper function to determine related SOPs based on phase
function getRelatedSOPIds(phase: number): string[] {
  const relatedSOPs: Record<number, string[]> = {
    1: ['SOP-002'], // Pre-Initiate relates to Initiate
    2: ['SOP-001', 'SOP-003'], // Initiate relates to Pre-Initiate and Design
    3: ['SOP-002', 'SOP-004'], // Design relates to Initiate and Implement
    4: ['SOP-003', 'SOP-005'], // Implement relates to Design and Close
    5: ['SOP-004'] // Close relates to Implement
  };
  
  return relatedSOPs[phase] || [];
}

// Function to check if AgentSOP needs regeneration
export async function checkRegenerationNeeded(sopId: string): Promise<boolean> {
  try {
    await connectToDatabase();
    
    const humanSOP = await HumanSOP.findOne({ sopId, isActive: true });
    const agentSOP = await AgentSOP.findOne({ sopId, isActive: true });
    
    if (!humanSOP || !agentSOP) {
      return true; // Need to regenerate if either is missing
    }
    
    // Check if HumanSOP was updated after last sync
    return humanSOP.updatedAt > agentSOP.lastSyncedAt;
  } catch (error) {
    console.error('Error checking regeneration status:', error);
    return true; // Regenerate on error to be safe
  }
}