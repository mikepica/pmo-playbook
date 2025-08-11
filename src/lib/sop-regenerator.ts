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
    
    // Parse the markdown content with the actual title from HumanSOP
    const parsedSOP = parseSOPMarkdown(humanSOP.data.markdownContent, sopId, humanSOP.data.title);
    
    // Validate the structure
    const validation = validateSOPStructure(parsedSOP);
    
    // New validation system is much more permissive - only fail if completely empty
    if (validation.qualityScore < 5) {
      return {
        success: false,
        message: 'SOP appears to be empty or contains no extractable content. Please add some content.',
        errors: ['Add at least a title and some basic content'],
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
        relatedSopIds: getRelatedSOPIds(),
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
        relatedSopIds: getRelatedSOPIds(),
        humanSopId: humanSOP.id.toString()
      };
      
      const newAgentSOP = await AgentSOP.createSOP(sopId, agentSOPData, humanSOP.id);
      
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

// Helper function to determine related SOPs - now returns empty since phases are removed
function getRelatedSOPIds(): string[] {
  // Without phases, we don't have automatic relationship detection
  // Related SOPs could be determined by other means in the future (keywords, content analysis, etc.)
  return [];
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