import OpenAI from 'openai';
import { HumanSOP } from '@/models/HumanSOP';
import { 
  getAIConfig,
  getPrompt, 
  debugLog
} from './ai-config';

// Types for unified processing
export interface SOPReference {
  sopId: string;
  title: string;
  sections: string[];
  confidence: number;
  keyPoints: string[];
  applicability: string;
}

export interface CoverageAnalysis {
  overallConfidence: number;
  coverageLevel: 'high' | 'medium' | 'low';
  gaps: string[];
  responseStrategy: 'full_answer' | 'partial_answer' | 'escape_hatch';
  queryIntent: string;
  keyTopics: string[];
}

export interface UnifiedQueryResult {
  answer: string;
  sopReferences: SOPReference[];
  coverageAnalysis: CoverageAnalysis;
  processingTime: number;
  tokensUsed: number;
}

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
 * Parse XML response from SOP analysis
 */
function parseSOPAnalysisXML(xmlResponse: string): {
  sopReferences: SOPReference[];
  coverageAnalysis: CoverageAnalysis;
} {
  try {
    // Extract query analysis
    const queryIntentMatch = xmlResponse.match(/<intent>(.*?)<\/intent>/s);
    const keyTopicsMatch = xmlResponse.match(/<key_topics>(.*?)<\/key_topics>/s);
    
    const queryIntent = queryIntentMatch?.[1]?.trim() || 'Unknown intent';
    const keyTopics = keyTopicsMatch?.[1]?.trim().split(',').map(t => t.trim()) || [];

    // Extract SOP references
    const sopMatches = xmlResponse.matchAll(/<sop id="([^"]+)" confidence="([^"]+)">(.*?)<\/sop>/gs);
    const sopReferences: SOPReference[] = [];
    
    for (const match of sopMatches) {
      const sopId = match[1];
      const confidence = parseFloat(match[2]);
      const sopContent = match[3];
      
      const sectionsMatch = sopContent.match(/<relevant_sections>(.*?)<\/relevant_sections>/s);
      const keyPointsMatch = sopContent.match(/<key_points>(.*?)<\/key_points>/s);
      const applicabilityMatch = sopContent.match(/<applicability>(.*?)<\/applicability>/s);
      
      sopReferences.push({
        sopId,
        title: '', // Will be filled from database
        sections: sectionsMatch?.[1]?.trim().split(',').map(s => s.trim()) || [],
        confidence,
        keyPoints: keyPointsMatch?.[1]?.trim().split(',').map(p => p.trim()) || [],
        applicability: applicabilityMatch?.[1]?.trim() || 'Unknown'
      });
    }

    // Extract coverage evaluation
    const overallConfidenceMatch = xmlResponse.match(/<overall_confidence>(.*?)<\/overall_confidence>/s);
    const coverageLevelMatch = xmlResponse.match(/<coverage_level>(.*?)<\/coverage_level>/s);
    const gapsMatch = xmlResponse.match(/<gaps>(.*?)<\/gaps>/s);
    const responseStrategyMatch = xmlResponse.match(/<response_strategy>(.*?)<\/response_strategy>/s);

    const overallConfidence = parseFloat(overallConfidenceMatch?.[1]?.trim() || '0');
    const coverageLevel = (coverageLevelMatch?.[1]?.trim() || 'low') as 'high' | 'medium' | 'low';
    const gaps = gapsMatch?.[1]?.trim().split(',').map(g => g.trim()).filter(g => g) || [];
    const responseStrategy = (responseStrategyMatch?.[1]?.trim() || 'escape_hatch') as 'full_answer' | 'partial_answer' | 'escape_hatch';

    const coverageAnalysis: CoverageAnalysis = {
      overallConfidence,
      coverageLevel,
      gaps,
      responseStrategy,
      queryIntent,
      keyTopics
    };

    return { sopReferences, coverageAnalysis };

  } catch (error) {
    console.error('Error parsing XML response:', error);
    
    // Fallback to escape hatch on parsing errors
    return {
      sopReferences: [],
      coverageAnalysis: {
        overallConfidence: 0.1,
        coverageLevel: 'low',
        gaps: ['Unable to analyze SOPs due to processing error'],
        responseStrategy: 'escape_hatch',
        queryIntent: 'Unknown',
        keyTopics: []
      }
    };
  }
}

/**
 * Analyze SOPs using XML-structured approach
 */
async function analyzeSopsWithXML(
  userQuery: string, 
  conversationContext: Array<{role: 'user' | 'assistant', content: string}> = []
): Promise<{ sopReferences: SOPReference[], coverageAnalysis: CoverageAnalysis }> {
  const startTime = Date.now();
  
  try {
    // Get all available SOPs
    const humanSOPs = await HumanSOP.getAllActiveSOPs();
    
    if (humanSOPs.length === 0) {
      return {
        sopReferences: [],
        coverageAnalysis: {
          overallConfidence: 0,
          coverageLevel: 'low',
          gaps: ['No SOPs available in database'],
          responseStrategy: 'escape_hatch',
          queryIntent: userQuery,
          keyTopics: []
        }
      };
    }

    // Build SOP summaries for analysis
    const sopSummaries = humanSOPs.map(sop => {
      const contentExcerpt = sop.data.markdownContent
        .replace(/^#.*$/gm, '') // Remove headers
        .replace(/\n\s*\n/g, ' ') // Collapse whitespace
        .trim()
        .substring(0, 400)
        .replace(/\s+/g, ' ');
      
      return `- SOP ID: ${sop.sopId}
   Title: "${sop.data.title}"
   Content Preview: "${contentExcerpt}..."`;
    }).join('\n\n');

    // Get prompts from configuration
    const config = getAIConfig();
    const systemPrompt = getPrompt('system_base');
    const analysisPrompt = getPrompt('sop_analysis_xml');
    
    // Build context string if available
    const contextString = conversationContext.length > 0 
      ? `\n\nConversation Context:\n${conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    const fullPrompt = `${analysisPrompt}

User Query: "${userQuery}"${contextString}

Available SOPs:
${sopSummaries}`;

    debugLog('log_xml_processing', 'Starting XML SOP analysis', { 
      query: userQuery,
      sopCount: humanSOPs.length,
      promptLength: fullPrompt.length 
    });

    // Make AI call
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: config.sop_selection?.model || config.processing?.model || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt }
      ],
      temperature: config.sop_selection?.temperature || config.processing?.temperature || 0.2,
      max_tokens: 2000
    });

    const xmlContent = response.choices[0]?.message?.content;
    if (!xmlContent) {
      throw new Error('No response from AI for SOP analysis');
    }

    debugLog('log_xml_processing', 'Received XML analysis', { 
      contentLength: xmlContent.length,
      duration: Date.now() - startTime 
    });

    // Parse XML response
    const { sopReferences, coverageAnalysis } = parseSOPAnalysisXML(xmlContent);

    // Fill in SOP titles from database
    for (const ref of sopReferences) {
      const sop = humanSOPs.find(s => s.sopId === ref.sopId);
      if (sop) {
        ref.title = sop.data.title;
      }
    }

    debugLog('log_coverage_analysis', 'Coverage analysis complete', {
      overallConfidence: coverageAnalysis.overallConfidence,
      strategy: coverageAnalysis.responseStrategy,
      sopCount: sopReferences.length
    });

    return { sopReferences, coverageAnalysis };

  } catch (error) {
    console.error('Error in SOP analysis:', error);
    
    // Return escape hatch configuration on error
    return {
      sopReferences: [],
      coverageAnalysis: {
        overallConfidence: 0.1,
        coverageLevel: 'low',
        gaps: ['Error occurred during SOP analysis'],
        responseStrategy: 'escape_hatch',
        queryIntent: userQuery,
        keyTopics: []
      }
    };
  }
}

/**
 * Generate unified answer based on coverage analysis
 */
async function generateUnifiedAnswer(
  userQuery: string,
  sopReferences: SOPReference[],
  coverageAnalysis: CoverageAnalysis,
  conversationContext: Array<{role: 'user' | 'assistant', content: string}> = []
): Promise<string> {
  const startTime = Date.now();
  
  try {
    const config = getAIConfig();
    const systemPrompt = getPrompt('system_base');
    const generationPrompt = getPrompt('answer_generation_unified');
    
    // Get full SOP content for referenced SOPs
    const fullSOPContent = await Promise.all(
      sopReferences.map(async (ref) => {
        try {
          const sop = await HumanSOP.findBySopId(ref.sopId);
          return {
            sopId: ref.sopId,
            title: ref.title,
            content: sop?.data.markdownContent || 'Content not available',
            confidence: ref.confidence,
            sections: ref.sections,
            keyPoints: ref.keyPoints
          };
        } catch {
          return {
            sopId: ref.sopId,
            title: ref.title,
            content: 'Content not available',
            confidence: ref.confidence,
            sections: ref.sections,
            keyPoints: ref.keyPoints
          };
        }
      })
    );

    // Build SOP content string
    const sopContentString = fullSOPContent.map(sop => 
      `SOP ${sop.sopId} - ${sop.title} (confidence: ${Math.round(sop.confidence * 100)}%):
${sop.content}
`
    ).join('\n---\n\n');

    // Build analysis XML for context
    const analysisXML = `<coverage_analysis>
  <overall_confidence>${coverageAnalysis.overallConfidence}</overall_confidence>
  <coverage_level>${coverageAnalysis.coverageLevel}</coverage_level>
  <response_strategy>${coverageAnalysis.responseStrategy}</response_strategy>
  <gaps>${coverageAnalysis.gaps.join(', ')}</gaps>
</coverage_analysis>`;

    // Build context string
    const contextString = conversationContext.length > 0 
      ? `\n\nConversation Context:\n${conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    // Replace template variables in prompt
    const fullPrompt = generationPrompt
      .replace('{{userQuery}}', userQuery)
      .replace('{{sopAnalysisXML}}', analysisXML)
      .replace('{{coverageLevel}}', coverageAnalysis.coverageLevel) +
      `${contextString}

Available SOP Content:
${sopContentString}`;

    debugLog('log_xml_processing', 'Generating unified answer', {
      strategy: coverageAnalysis.responseStrategy,
      sopCount: sopReferences.length,
      confidence: coverageAnalysis.overallConfidence
    });

    // Make AI call
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: config.processing?.model || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt }
      ],
      temperature: config.processing?.temperature || 0.3,
      max_tokens: config.processing?.max_tokens || 2000
    });

    const answer = response.choices[0]?.message?.content;
    if (!answer) {
      throw new Error('No response from AI for answer generation');
    }

    debugLog('log_xml_processing', 'Answer generation complete', {
      answerLength: answer.length,
      duration: Date.now() - startTime
    });

    return answer;

  } catch (error) {
    console.error('Error in answer generation:', error);
    
    // Fallback to escape hatch message
    const config = getAIConfig();
    const escapeMessage = config.escape_hatch?.message_template || 
      "The Playbook does not explicitly provide guidance for {topic}.\n\n📝 This appears to be a gap in our Playbook. Please leave feedback so we can add appropriate guidance for this topic.";
    
    return escapeMessage.replace('{topic}', coverageAnalysis.queryIntent);
  }
}

/**
 * Main unified query processing function
 */
export async function processQuery(
  userQuery: string,
  conversationContext: Array<{role: 'user' | 'assistant', content: string}> = []
): Promise<UnifiedQueryResult> {
  const startTime = Date.now();
  let totalTokensUsed = 0;

  debugLog('log_xml_processing', 'Starting unified query processing', { 
    query: userQuery.substring(0, 100) + '...',
    contextLength: conversationContext.length 
  });

  try {
    // Step 1: Analyze SOPs with XML structure
    const { sopReferences, coverageAnalysis } = await analyzeSopsWithXML(userQuery, conversationContext);
    
    // Step 2: Generate unified answer based on coverage
    const answer = await generateUnifiedAnswer(userQuery, sopReferences, coverageAnalysis, conversationContext);

    const result: UnifiedQueryResult = {
      answer,
      sopReferences,
      coverageAnalysis,
      processingTime: Date.now() - startTime,
      tokensUsed: totalTokensUsed
    };

    debugLog('log_xml_processing', 'Unified processing complete', {
      strategy: coverageAnalysis.responseStrategy,
      confidence: coverageAnalysis.overallConfidence,
      processingTime: result.processingTime,
      sopCount: sopReferences.length
    });

    return result;

  } catch (error) {
    console.error('Error in unified query processing:', error);
    
    // Return fallback result
    return {
      answer: "I encountered an error processing your query. 📝 Please leave feedback so we can investigate and improve the system.",
      sopReferences: [],
      coverageAnalysis: {
        overallConfidence: 0,
        coverageLevel: 'low',
        gaps: ['System error during processing'],
        responseStrategy: 'escape_hatch',
        queryIntent: userQuery,
        keyTopics: []
      },
      processingTime: Date.now() - startTime,
      tokensUsed: 0
    };
  }
}