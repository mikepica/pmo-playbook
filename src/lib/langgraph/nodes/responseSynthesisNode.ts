import { ChatOpenAI } from '@langchain/openai';
import { WorkflowState, StateHelpers } from '../state';
import { HumanSOP } from '@/models/HumanSOP';

/**
 * Response Synthesis Node
 * Generates the final answer based on coverage analysis and SOPs
 * Replaces the generateUnifiedAnswer function from unified-query-processor
 */
export async function responseSynthesisNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  
  try {
    console.log('log_xml_processing', 'Starting response synthesis', {
      strategy: state.coverageAnalysis.responseStrategy,
      sopCount: state.sopReferences.length,
      confidence: state.confidence
    });

    const config = { processing: { model: process.env.OPENAI_MODEL || 'gpt-4o', temperature: 0.3, max_tokens: 8000 } };
    const systemPrompt = `You are an expert PMO consultant. Your role is to directly answer the user's specific question by synthesizing relevant information from the company's SOPs. Focus on what the user asked for, not general SOP descriptions.`;
    
    // Handle escape hatch case early
    if (state.coverageAnalysis.responseStrategy === 'escape_hatch') {
      const escapeResponse = generateEscapeHatchResponse(config, state.coverageAnalysis.queryIntent);
      
      return {
        ...StateHelpers.markComplete(state),
        response: escapeResponse,
        currentNode: 'complete'
      };
    }

    // Get full SOP content for referenced SOPs
    const fullSOPContent = await Promise.all(
      state.sopReferences.map(async (ref) => {
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
  <overall_confidence>${state.coverageAnalysis.overallConfidence}</overall_confidence>
  <coverage_level>${state.coverageAnalysis.coverageLevel}</coverage_level>
  <response_strategy>${state.coverageAnalysis.responseStrategy}</response_strategy>
  <gaps>${state.coverageAnalysis.gaps.join(', ')}</gaps>
</coverage_analysis>`;

    // Build context string
    const contextString = state.conversationContext.length > 0 
      ? `\n\nConversation Context:\n${state.conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    // Build generation prompt now that analysisXML is available
    const generationPrompt = `User Query: "${state.query}"
Query Intent: ${state.coverageAnalysis.queryIntent}

Based on the SOPs provided, directly answer the user's question.

Instructions:
1. Focus ONLY on answering what the user asked about
2. Extract and synthesize relevant information from ALL provided SOPs
3. If the user asks "what does X do", list their specific roles and responsibilities
4. Do NOT just describe the SOPs or their phases - answer the specific question
5. Organize the answer clearly with the most relevant information first
6. Use the key points identified in the SOP analysis to guide your response

Coverage Analysis:
${analysisXML}

Answer the user's question directly using the SOP content below:`;

    // Build the full prompt with context and SOP content
    const fullPrompt = `${generationPrompt}${contextString}

Available SOP Content:
${sopContentString}`;

    // Make AI call
    const llm = new ChatOpenAI({
      modelName: config.processing?.model || 'gpt-4o',
      temperature: config.processing?.temperature || 0.3,
      maxTokens: config.processing?.max_tokens || 8000
    });

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: fullPrompt }
    ]);

    const answer = response.content as string;
    if (!answer) {
      throw new Error('No response from AI for answer generation');
    }

    // Update state with LLM call metadata
    const updatedState = StateHelpers.addLLMCall(state, {
      node: 'responseSynthesis',
      model: config.processing?.model || 'gpt-4o',
      tokensIn: estimateTokens(fullPrompt),
      tokensOut: estimateTokens(answer),
      latency: Date.now() - startTime,
      success: true
    });

    console.log('log_xml_processing', 'Response synthesis complete', {
      answerLength: answer.length,
      duration: Date.now() - startTime
    });

    return {
      ...StateHelpers.markComplete(updatedState),
      response: answer,
      currentNode: 'complete'
    };

  } catch (error) {
    console.error('Error in response synthesis node:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in response synthesis';
    
    // Fallback to escape hatch on error
    const config = { processing: { model: process.env.OPENAI_MODEL || 'gpt-4o', temperature: 0.3, max_tokens: 8000 } };
    const escapeResponse = generateEscapeHatchResponse(config, state.coverageAnalysis.queryIntent);
    
    return {
      ...StateHelpers.addError(state, `Response synthesis failed: ${errorMessage}`),
      ...StateHelpers.markComplete(state),
      response: escapeResponse,
      currentNode: 'complete'
    };
  }
}

/**
 * Generate escape hatch response when coverage is insufficient
 */
function generateEscapeHatchResponse(_config: { processing: { model: string; temperature: number; max_tokens: number } }, queryIntent: string): string {
  const escapeTemplate = "The Playbook does not explicitly provide guidance for {topic}.\n\n📝 This appears to be a gap in our Playbook. Please leave feedback so we can add appropriate guidance for this topic.";
  
  return escapeTemplate.replace('{topic}', queryIntent);
}

/**
 * Simple token estimation function
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}