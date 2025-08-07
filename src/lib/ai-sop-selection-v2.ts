import OpenAI from 'openai';
import { AgentSOP } from '@/models/AgentSOP';
import { getAIConfig, getModeConfig, getPrompt, debugLog, isFeatureEnabled } from './ai-config';
import { AIPromptBuilder, TemplateEngine, TemplateContext } from './template-engine';
import { 
  SOPSelectionResult, 
  SOPGenerationResult, 
  GeneralKnowledgeResult,
  AIModeConfig 
} from './ai-config';

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  
  return openai;
}

/**
 * Multi-SOP Selection - Enhanced version that can select 1-3 SOPs
 */
export async function selectBestSOPs(userQuery: string): Promise<SOPSelectionResult> {
  try {
    debugLog('log_sop_selection_reasoning', 'Starting multi-SOP selection', { userQuery });

    const config = getAIConfig();
    const modeConfig = getModeConfig('sop_selection');
    
    // Get all SOP summaries with enhanced context
    const sopSummaries = await AgentSOP.getAllSummaries();
    
    if (sopSummaries.length === 0) {
      throw new Error('No SOPs available in database');
    }

    // Build the prompt using template engine
    const systemPrompt = getPrompt('sop_selection_system');
    const userPromptTemplate = getPrompt('sop_selection_user');
    
    const userPrompt = AIPromptBuilder.buildSOPSelectionPrompt(
      userQuery,
      sopSummaries,
      userPromptTemplate,
      {
        flow: config.flow,
        multi_sop: config.multi_sop
      }
    );

    debugLog('log_token_usage', 'SOP Selection tokens', {
      systemPrompt: systemPrompt.length,
      userPrompt: userPrompt.length
    });

    // Make AI call
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: modeConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: modeConfig.temperature,
      max_tokens: modeConfig.max_tokens
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    debugLog('log_sop_selection_reasoning', 'AI Selection Response', { content });

    // Parse the response
    const result = parseSOPSelectionResponse(content, sopSummaries);

    debugLog('log_confidence_scores', 'SOP Selection Results', {
      strategy: result.strategy,
      sopCount: result.selectedSops.length,
      overallConfidence: result.overallConfidence
    });

    return result;

  } catch (error) {
    console.error('Error in selectBestSOPs:', error);
    
    // Fallback strategy based on configuration
    const config = getAIConfig();
    if (config.flow.fallback_to_general) {
      return {
        strategy: 'general_knowledge',
        selectedSops: [],
        overallConfidence: 0.1,
        reasoning: 'Fallback to general knowledge due to selection error'
      };
    }
    
    // Last resort: return first SOP with low confidence
    const sopSummaries = await AgentSOP.getAllSummaries();
    if (sopSummaries.length > 0) {
      return {
        strategy: 'single_sop',
        selectedSops: [{
          sopId: sopSummaries[0].sopId,
          confidence: 0.1,
          role: 'primary',
          reasoning: 'Fallback selection due to error'
        }],
        overallConfidence: 0.1,
        reasoning: 'Error fallback to first available SOP'
      };
    }
    
    throw error;
  }
}

/**
 * Generate answer using selected SOPs (multi-SOP capable)
 */
export async function generateMultiSOPAnswer(
  userQuery: string, 
  selection: SOPSelectionResult,
  conversationContext?: Array<{role: 'user' | 'assistant', content: string}>
): Promise<SOPGenerationResult> {
  try {
    debugLog('log_sop_selection_reasoning', 'Starting multi-SOP answer generation', {
      strategy: selection.strategy,
      sopCount: selection.selectedSops.length
    });

    if (selection.strategy === 'general_knowledge') {
      throw new Error('Use generateGeneralAnswer for general knowledge strategy');
    }

    const config = getAIConfig();
    const modeConfig = getModeConfig('sop_generation');
    
    // Retrieve full SOP content for selected SOPs
    const sopIds = selection.selectedSops.map(s => s.sopId);
    const fullSOPs = await AgentSOP.findMultipleBySopIds(sopIds);
    
    if (fullSOPs.length === 0) {
      throw new Error('No SOPs found for selected IDs');
    }

    // Organize SOPs by role
    const primarySOPs = fullSOPs.filter(sop => 
      selection.selectedSops.find(s => s.sopId === sop.sopId && s.role === 'primary')
    );
    const supportingSOPs = fullSOPs.filter(sop => 
      selection.selectedSops.find(s => s.sopId === sop.sopId && s.role !== 'primary')
    );

    const primarySop = primarySOPs[0] || fullSOPs[0]; // Ensure we have a primary
    const sopContexts = fullSOPs.map(sop => AgentSOP.prototype.generateAIContext(sop));

    // Build the prompt
    const systemPrompt = getPrompt('sop_generation_system');
    const userPromptTemplate = getPrompt('sop_generation_user');

    const userPrompt = AIPromptBuilder.buildMultiSOPPrompt(
      userQuery,
      sopContexts.find(ctx => ctx.sopId === primarySop.sopId)!,
      sopContexts.filter(ctx => ctx.sopId !== primarySop.sopId),
      conversationContext || [],
      userPromptTemplate
    );

    debugLog('log_token_usage', 'Multi-SOP Generation tokens', {
      systemPrompt: systemPrompt.length,
      userPrompt: userPrompt.length,
      sopCount: fullSOPs.length
    });

    // Make AI call
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: modeConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: modeConfig.temperature,
      max_tokens: modeConfig.max_tokens
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI for answer generation');
    }

    // Parse the response
    const result = parseSOPGenerationResponse(content, fullSOPs);

    debugLog('log_token_usage', 'Answer generation completed', {
      answerLength: result.answer.length,
      sourceCount: result.sopSources.length
    });

    return result;

  } catch (error) {
    console.error('Error in generateMultiSOPAnswer:', error);
    throw error;
  }
}

/**
 * Generate answer using general PM knowledge
 */
export async function generateGeneralAnswer(
  userQuery: string,
  conversationContext?: Array<{role: 'user' | 'assistant', content: string}>
): Promise<GeneralKnowledgeResult> {
  try {
    debugLog('log_sop_selection_reasoning', 'Starting general knowledge answer generation', { userQuery });

    const modeConfig = getModeConfig('general_knowledge');
    
    // Build the prompt
    const systemPrompt = getPrompt('general_knowledge_system');
    const userPromptTemplate = getPrompt('general_knowledge_user');

    const userPrompt = AIPromptBuilder.buildGeneralKnowledgePrompt(
      userQuery,
      conversationContext || [],
      userPromptTemplate
    );

    debugLog('log_token_usage', 'General Knowledge tokens', {
      systemPrompt: systemPrompt.length,
      userPrompt: userPrompt.length
    });

    // Make AI call
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: modeConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: modeConfig.temperature,
      max_tokens: modeConfig.max_tokens
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI for general answer generation');
    }

    // Parse the response
    const result = parseGeneralKnowledgeResponse(content);

    debugLog('log_token_usage', 'General knowledge answer completed', {
      answerLength: result.answer.length,
      methodologyCount: result.methodologies.length
    });

    return result;

  } catch (error) {
    console.error('Error in generateGeneralAnswer:', error);
    throw error;
  }
}

/**
 * Parse SOP selection AI response
 */
function parseSOPSelectionResponse(content: string, availableSOPs: any[]): SOPSelectionResult {
  try {
    let cleanContent = content.trim();
    
    // Remove markdown code blocks if present
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const result = JSON.parse(cleanContent) as SOPSelectionResult;
    
    // Validate the result structure
    if (!result.strategy || !Array.isArray(result.selectedSops)) {
      throw new Error('Invalid response structure');
    }

    // For general knowledge, return as-is
    if (result.strategy === 'general_knowledge') {
      return result;
    }

    // Validate selected SOPs exist
    for (const selectedSop of result.selectedSops) {
      const sopExists = availableSOPs.find(sop => sop.sopId === selectedSop.sopId);
      if (!sopExists) {
        throw new Error(`Selected SOP ${selectedSop.sopId} not found in available SOPs`);
      }
    }

    // Ensure confidence scores are within bounds
    result.selectedSops = result.selectedSops.map(sop => ({
      ...sop,
      confidence: Math.max(0, Math.min(1, sop.confidence))
    }));
    
    result.overallConfidence = Math.max(0, Math.min(1, result.overallConfidence));

    return result;

  } catch (parseError) {
    throw new Error(`Failed to parse SOP selection response: ${content}`);
  }
}

/**
 * Parse SOP generation AI response
 */
function parseSOPGenerationResponse(content: string, usedSOPs: any[]): SOPGenerationResult {
  try {
    let cleanContent = content.trim();
    
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const aiResponse = JSON.parse(cleanContent);
    
    return {
      answer: aiResponse.answer,
      sopSources: aiResponse.sopSources || usedSOPs.map(sop => ({
        sopId: sop.sopId,
        contribution: `Information from ${sop.data.title}`
      })),
      crossReferences: aiResponse.crossReferences || []
    };

  } catch (parseError) {
    throw new Error(`Failed to parse SOP generation response: ${content}`);
  }
}

/**
 * Parse general knowledge AI response
 */
function parseGeneralKnowledgeResponse(content: string): GeneralKnowledgeResult {
  try {
    let cleanContent = content.trim();
    
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const aiResponse = JSON.parse(cleanContent);
    
    return {
      answer: aiResponse.answer,
      methodologies: aiResponse.methodologies || [],
      recommendedTools: aiResponse.recommendedTools || [],
      bestPractices: aiResponse.bestPractices || []
    };

  } catch (parseError) {
    throw new Error(`Failed to parse general knowledge response: ${content}`);
  }
}

/**
 * Legacy compatibility functions
 */
export async function selectBestSOP(userQuery: string): Promise<{
  selectedSopId: string;
  confidence: number;
  reasoning: string;
}> {
  const result = await selectBestSOPs(userQuery);
  
  if (result.strategy === 'general_knowledge') {
    return {
      selectedSopId: 'GENERAL_PM_KNOWLEDGE',
      confidence: result.overallConfidence,
      reasoning: result.reasoning
    };
  }

  const primarySop = result.selectedSops.find(s => s.role === 'primary') || result.selectedSops[0];
  return {
    selectedSopId: primarySop.sopId,
    confidence: primarySop.confidence,
    reasoning: primarySop.reasoning
  };
}

export async function generateAnswer(
  userQuery: string, 
  selectedSopId: string,
  conversationContext?: Array<{role: 'user' | 'assistant', content: string}>
): Promise<{
  answer: string;
  sourceInfo: {
    sopId: string;
    title: string;
    phase: number;
  };
}> {
  if (selectedSopId === 'GENERAL_PM_KNOWLEDGE') {
    const result = await generateGeneralAnswer(userQuery, conversationContext);
    return {
      answer: result.answer,
      sourceInfo: {
        sopId: 'GENERAL_PM_KNOWLEDGE',
        title: 'General PM Expertise',
        phase: 0
      }
    };
  }

  // Convert to multi-SOP format for single SOP
  const multiResult = await generateMultiSOPAnswer(
    userQuery,
    {
      strategy: 'single_sop',
      selectedSops: [{ sopId: selectedSopId, confidence: 1.0, role: 'primary', reasoning: 'Direct selection' }],
      overallConfidence: 1.0,
      reasoning: 'Legacy single SOP call'
    },
    conversationContext
  );

  const sop = await AgentSOP.findBySopId(selectedSopId);
  return {
    answer: multiResult.answer,
    sourceInfo: {
      sopId: selectedSopId,
      title: sop?.data.title || 'Unknown SOP',
      phase: sop?.phase || 0
    }
  };
}