import { ChatOpenAI } from '@langchain/openai';
import { WorkflowState, StateHelpers } from '../state';

/**
 * Follow-up Generation Node
 * Generates clarifying questions when confidence is low and significant gaps exist
 * Helps users provide more specific information for better responses
 */
export async function followUpGenerationNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  
  try {
    console.log('log_xml_processing', 'Starting follow-up generation node', {
      confidence: state.confidence,
      strategy: state.coverageAnalysis.responseStrategy,
      gaps: state.coverageAnalysis.gaps.length
    });

    // Only generate follow-ups for escape hatch scenarios with multiple gaps
    if (state.coverageAnalysis.responseStrategy !== 'escape_hatch' || 
        state.coverageAnalysis.gaps.length < 2) {
      console.log('log_xml_processing', 'Skipping follow-up generation - conditions not met', {
        strategy: state.coverageAnalysis.responseStrategy,
        gapCount: state.coverageAnalysis.gaps.length
      });
      
      return {
        ...StateHelpers.markNodeComplete(state, 'followUpGeneration'),
        currentNode: 'responseGeneration'
      };
    }

    const config = { processing: { model: process.env.OPENAI_MODEL || 'gpt-4o', temperature: 0.3 } };
    const systemPrompt = `You are an expert PMO consultant with 15+ years of experience. Your role is to generate helpful follow-up questions and suggestions.`;

    // Build context about what we do know
    const availableInfo = state.sopReferences.length > 0 
      ? `Available related information:
${state.sopReferences.map(ref => 
  `- ${ref.title} (confidence: ${Math.round(ref.confidence * 100)}%): ${ref.keyPoints.slice(0, 2).join(', ')}`
).join('\n')}`
      : 'No directly relevant SOPs found in the playbook.';

    const followUpPrompt = `
You are a PMO consultant helping a user get better guidance from our playbook system.

The user asked: "${state.query}"
We identified their intent as: "${state.coverageAnalysis.queryIntent}"
Key topics: ${state.coverageAnalysis.keyTopics.join(', ')}

Our analysis shows:
- Overall confidence: ${Math.round(state.coverageAnalysis.overallConfidence * 100)}%
- Coverage level: ${state.coverageAnalysis.coverageLevel}
- Strategy: ${state.coverageAnalysis.responseStrategy}

${availableInfo}

Coverage gaps identified:
${state.coverageAnalysis.gaps.map(gap => `- ${gap}`).join('\n')}

Your task: Generate 3-5 specific follow-up questions that would help the user:
1. Provide more context about their specific situation
2. Clarify ambiguous aspects of their request  
3. Identify the most relevant parts of the playbook to search
4. Get actionable guidance despite the current gaps

Make the questions:
- Specific and actionable (not generic)
- Focused on filling the identified gaps
- Relevant to PMO/project management context
- Easy for the user to answer

Format your response as:
FOLLOW_UP_QUESTIONS:
1. [Specific question about context/situation]
2. [Question about clarifying scope or constraints]
3. [Question about specific processes or outcomes needed]
4. [Question about timeline or urgency if relevant]
5. [Question about stakeholders or resources if relevant]

Keep each question under 20 words and directly related to getting better playbook coverage.
`;

    const llm = new ChatOpenAI({
      modelName: config.processing?.model || 'gpt-4o',
      temperature: 0.6, // Higher temperature for creative question generation
      maxTokens: 1000
    });

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: followUpPrompt }
    ]);

    const followUpContent = response.content as string;
    
    if (!followUpContent) {
      throw new Error('No response from AI for follow-up generation');
    }

    // Parse follow-up questions
    const followUpSuggestions = parseFollowUpQuestions(followUpContent);

    if (followUpSuggestions.length === 0) {
      // Fallback questions based on gaps
      const fallbackQuestions = generateFallbackQuestions(state);
      followUpSuggestions.push(...fallbackQuestions);
    }

    // Update state with LLM call metadata
    const updatedState = StateHelpers.addLLMCall(state, {
      node: 'followUpGeneration',
      model: config.processing?.model || 'gpt-4o',
      tokensIn: estimateTokens(followUpPrompt),
      tokensOut: estimateTokens(followUpContent),
      latency: Date.now() - startTime,
      success: true
    });

    const finalState = StateHelpers.addConfidenceEntry(
      updatedState,
      'followUpGeneration',
      state.confidence, // No confidence change for follow-up generation
      `Generated ${followUpSuggestions.length} follow-up questions to improve coverage`
    );

    console.log('log_xml_processing', 'Follow-up generation completed', {
      questionsGenerated: followUpSuggestions.length,
      duration: Date.now() - startTime
    });

    return {
      ...StateHelpers.markNodeComplete(finalState, 'followUpGeneration'),
      followUpSuggestions,
      currentNode: 'responseGeneration'
    };

  } catch (error) {
    console.error('Error in follow-up generation node:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in follow-up generation';
    
    // Generate basic fallback questions on error
    const fallbackQuestions = generateFallbackQuestions(state);
    
    return {
      ...StateHelpers.addError(state, `Follow-up generation failed: ${errorMessage}`),
      ...StateHelpers.markNodeComplete(state, 'followUpGeneration'),
      followUpSuggestions: fallbackQuestions,
      currentNode: 'responseGeneration'
    };
  }
}

/**
 * Parse follow-up questions from AI response
 */
function parseFollowUpQuestions(content: string): string[] {
  const questions: string[] = [];
  
  try {
    // Look for numbered list after "FOLLOW_UP_QUESTIONS:"
    const questionsSection = content.match(/FOLLOW_UP_QUESTIONS:(.*?)(?:\n\n|$)/is);
    
    if (questionsSection) {
      const lines = questionsSection[1].split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Match numbered questions like "1. Question text"
        const questionMatch = trimmedLine.match(/^\d+\.\s*(.+)$/);
        if (questionMatch && questionMatch[1]) {
          const question = questionMatch[1].trim();
          if (question.length > 10) { // Basic quality check
            questions.push(question);
          }
        }
      }
    }
    
    // Fallback: look for any lines that end with question marks
    if (questions.length === 0) {
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.endsWith('?') && trimmedLine.length > 15) {
          questions.push(trimmedLine.replace(/^\d+\.\s*/, '').trim());
        }
      }
    }
    
  } catch (error) {
    console.error('Error parsing follow-up questions:', error);
  }
  
  return questions.slice(0, 5); // Limit to 5 questions max
}

/**
 * Generate fallback questions when AI generation fails
 */
function generateFallbackQuestions(state: WorkflowState): string[] {
  const questions: string[] = [];
  
  // Base questions on the query intent and gaps
  const intent = state.coverageAnalysis.queryIntent.toLowerCase();
  
  if (intent.includes('process') || intent.includes('procedure')) {
    questions.push("What specific process stage or step are you most concerned about?");
    questions.push("Are there any constraints or requirements specific to your project?");
  }
  
  if (intent.includes('problem') || intent.includes('issue') || intent.includes('challenge')) {
    questions.push("Can you describe the specific symptoms or impacts you're experiencing?");
    questions.push("What have you already tried to address this issue?");
  }
  
  if (intent.includes('decision') || intent.includes('choose') || intent.includes('approach')) {
    questions.push("What are the main factors or criteria driving this decision?");
    questions.push("What are the potential risks or constraints you need to consider?");
  }
  
  // Always include these general clarifying questions
  questions.push("What is the timeline or urgency level for this situation?");
  questions.push("Which stakeholders or team members are involved?");
  
  return questions.slice(0, 5);
}

/**
 * Simple token estimation function
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}