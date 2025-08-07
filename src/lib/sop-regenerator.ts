// PostgreSQL database connection handled by models
import { HumanSOP } from '@/models/HumanSOP';
import { AgentSOP } from '@/models/AgentSOP';
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
    // Fetch the HumanSOP
    const humanSOP = await HumanSOP.findBySopId(sopId);
    
    if (!humanSOP) {
      return {
        success: false,
        message: `HumanSOP with ID ${sopId} not found`
      };
    }
    
    // Parse the markdown content
    const parsedSOP = parseSOPMarkdown(humanSOP.data.markdownContent, sopId);
    
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
    const existingAgentSOP = await AgentSOP.findBySopId(sopId);
    
    if (existingAgentSOP) {
      // Update existing AgentSOP
      const newVersion = (existingAgentSOP.version || 1) + 1;
      const updatedData = {
        title: parsedSOP.title,
        summary: parsedSOP.summary,
        description: parsedSOP.description,
        sections: parsedSOP.sections,
        keywords: parsedSOP.keywords,
        relatedSopIds: getRelatedSOPIds(parsedSOP.phase),
        humanSopId: humanSOP.id.toString()
      };
      
      const results = await AgentSOP.update(
        { id: existingAgentSOP.id },
        { 
          data: JSON.stringify(updatedData),
          version: newVersion,
          last_synced_at: new Date()
        }
      );
      
      const updatedAgentSOP = results[0] ? AgentSOP.mapToRecord(results[0]) : null;
      
      return {
        success: true,
        message: `AgentSOP ${sopId} regenerated successfully (v${newVersion})`,
        agentSOP: {
          sopId: sopId,
          title: parsedSOP.title,
          parsedContent: updatedData,
          version: newVersion
        },
        warnings: validation.warnings
      };
    } else {
      // Create new AgentSOP
      const agentSOPData = {
        title: parsedSOP.title,
        summary: parsedSOP.summary,
        description: parsedSOP.description,
        sections: parsedSOP.sections,
        keywords: parsedSOP.keywords,
        relatedSopIds: getRelatedSOPIds(parsedSOP.phase),
        humanSopId: humanSOP.id.toString()
      };
      
      const newAgentSOP = await AgentSOP.createSOP(sopId, parsedSOP.phase, agentSOPData, humanSOP.id);
      
      return {
        success: true,
        message: `AgentSOP ${sopId} created successfully`,
        agentSOP: {
          sopId: sopId,
          title: parsedSOP.title,
          parsedContent: agentSOPData,
          version: 1
        },
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
    // Get all active HumanSOPs
    const humanSOPs = await HumanSOP.getAllActiveSOPs();
    
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
    const humanSOP = await HumanSOP.findBySopId(sopId);
    const agentSOP = await AgentSOP.findBySopId(sopId);
    
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