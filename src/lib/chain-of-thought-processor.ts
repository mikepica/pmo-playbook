import OpenAI from 'openai';
import { HumanSOP } from '@/models/HumanSOP';
import { 
  getAIConfig, 
  getChainOfThoughtConfig, 
  getResponseModeConfig, 
  getContextManagementConfig,
  getDefaultsConfig,
  debugLog 
} from './ai-config';

export interface ChainOfThoughtStep {
  stage: 'analyze_query' | 'research_sops' | 'synthesize_answer' | 'validate_response';
  prompt: string;
  response: string;
  tokens_used: number;
  duration_ms: number;
}

export interface ChainOfThoughtResult {
  final_answer: string;
  reasoning_steps: ChainOfThoughtStep[];
  total_tokens_used: number;
  total_duration_ms: number;
  sop_sources: string[];
  confidence_score: number;
  refinement_iterations?: {
    iteration: number;
    confidence_before: number;
    confidence_after: number;
    improvement: number;
    steps: ChainOfThoughtStep[];
  }[];
}

export interface SOPContent {
  sopId: string;
  title: string;
  content: string;
  relevance_score: number;
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

export class ChainOfThoughtProcessor {
  private client: OpenAI;
  private config: any;
  private cotConfig: any;

  constructor() {
    this.client = getOpenAIClient();
    this.config = getAIConfig();
    this.cotConfig = getChainOfThoughtConfig();
  }

  /**
   * Process a query using chain-of-thought reasoning
   */
  async processQuery(
    userQuery: string,
    responseMode: 'quick' | 'standard' | 'comprehensive',
    conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>
  ): Promise<ChainOfThoughtResult> {
    const startTime = Date.now();
    const modeConfig = getResponseModeConfig(responseMode);
    
    // Get reasoning steps from config, fallback to default stages
    const reasoningSteps = modeConfig.reasoning_steps || Object.keys(this.cotConfig.stages);
    
    debugLog('log_chain_of_thought_steps', 'Starting chain-of-thought processing', {
      query: userQuery,
      mode: responseMode,
      configuredSteps: reasoningSteps
    });

    const result: ChainOfThoughtResult = {
      final_answer: '',
      reasoning_steps: [],
      total_tokens_used: 0,
      total_duration_ms: 0,
      sop_sources: [],
      confidence_score: 0,
      refinement_iterations: []
    };

    try {
      // Execute initial reasoning pass
      const initialResult = await this.executeReasoningPass(
        userQuery, 
        conversationHistory, 
        reasoningSteps
      );
      
      result.reasoning_steps = initialResult.steps;
      result.sop_sources = initialResult.sopSources;
      result.final_answer = initialResult.finalAnswer;
      result.confidence_score = initialResult.confidence;

      // Check if refinement is enabled and needed
      const refinementConfig = modeConfig.refinement;
      if (refinementConfig?.enabled && this.shouldRefine(result.confidence_score, refinementConfig)) {
        debugLog('log_chain_of_thought_steps', 'Starting iterative refinement', {
          initialConfidence: result.confidence_score,
          threshold: refinementConfig.confidence_threshold,
          maxIterations: refinementConfig.max_iterations
        });

        await this.performIterativeRefinement(
          userQuery,
          conversationHistory,
          result,
          refinementConfig
        );
      }

      // Calculate totals including refinement iterations
      let totalTokens = result.reasoning_steps.reduce((sum, step) => sum + step.tokens_used, 0);
      if (result.refinement_iterations) {
        for (const iteration of result.refinement_iterations) {
          totalTokens += iteration.steps.reduce((sum, step) => sum + step.tokens_used, 0);
        }
      }
      result.total_tokens_used = totalTokens;
      result.total_duration_ms = Date.now() - startTime;

      debugLog('log_chain_of_thought_steps', 'Chain-of-thought processing completed', {
        steps: result.reasoning_steps.length,
        totalTokens: result.total_tokens_used,
        duration: result.total_duration_ms,
        confidence: result.confidence_score
      });

      return result;

    } catch (error) {
      console.error('Chain-of-thought processing failed:', error);
      throw new Error('Failed to process query with chain-of-thought reasoning');
    }
  }

  /**
   * Execute a single chain-of-thought stage
   */
  private async executeStage(
    stage: 'analyze_query' | 'research_sops' | 'synthesize_answer' | 'validate_response',
    userQuery: string,
    conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>,
    previousStageOutput?: string
  ): Promise<ChainOfThoughtStep> {
    const stepStartTime = Date.now();
    const stageConfig = this.cotConfig.stages[stage];
    
    debugLog('log_chain_of_thought_steps', `Executing stage: ${stage}`);

    // Build stage-specific prompt
    const prompt = await this.buildStagePrompt(stage, userQuery, conversationHistory, previousStageOutput);

    // Get system prompt for this stage
    const systemPrompt = this.config.prompts[`chain_of_thought_${stage}`] || 
      `You are an expert PMO consultant. ${stageConfig.description}`;

    try {
      const response = await this.client.chat.completions.create({
        model: stageConfig.llm,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: stageConfig.temperature,
      });

      const responseText = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      const duration = Date.now() - stepStartTime;

      debugLog('log_chain_of_thought_steps', `Stage ${stage} completed`, {
        tokens: tokensUsed,
        duration,
        responseLength: responseText.length
      });

      return {
        stage,
        prompt,
        response: responseText,
        tokens_used: tokensUsed,
        duration_ms: duration
      };

    } catch (error) {
      console.error(`Failed to execute stage ${stage}:`, error);
      throw error;
    }
  }

  /**
   * Build prompt for specific stage
   */
  private async buildStagePrompt(
    stage: string,
    userQuery: string,
    conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>,
    previousOutput?: string
  ): Promise<string> {
    let prompt = '';

    // Add conversation context if available
    if (conversationHistory && conversationHistory.length > 0) {
      prompt += 'Conversation Context:\n';
      conversationHistory.forEach(msg => {
        prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    switch (stage) {
      case 'analyze_query':
        prompt += `User Question: "${userQuery}"\n\n`;
        prompt += `Please analyze this question to understand:\n`;
        prompt += `1. What the user is really asking\n`;
        prompt += `2. What type of project management guidance they need\n`;
        prompt += `3. What level of detail would be most helpful\n`;
        prompt += `4. Any implicit requirements or context clues\n\n`;
        prompt += `Provide your analysis in a structured format.`;
        break;

      case 'research_sops':
        prompt += `User Question: "${userQuery}"\n\n`;
        if (previousOutput) {
          prompt += `Query Analysis:\n${previousOutput}\n\n`;
        }
        
        // Get available SOPs
        const sops = await HumanSOP.getAllActiveSOPs();
        const sopSummaries = sops.map(sop => {
          const excerpt = sop.data.markdownContent
            .substring(0, 300)
            .replace(/\n\s*\n/g, ' ')
            .trim();
          return `- SOP ID: ${sop.sopId}\n  Title: ${sop.data.title}\n  Content excerpt: ${excerpt}...`;
        }).join('\n\n');

        prompt += `Available SOPs:\n${sopSummaries}\n\n`;
        prompt += `Based on the analysis above, identify the most relevant SOPs and explain why each one is useful for answering the user's question. Focus on the specific information each SOP provides.`;
        break;

      case 'synthesize_answer':
        prompt += `User Question: "${userQuery}"\n\n`;
        if (previousOutput) {
          prompt += `Research Findings:\n${previousOutput}\n\n`;
        }
        
        prompt += `Now synthesize this information into a comprehensive, actionable answer. `;
        prompt += `Combine insights from multiple SOPs, show relationships between procedures, `;
        prompt += `and provide practical guidance the user can act on.`;
        break;

      case 'validate_response':
        prompt += `User Question: "${userQuery}"\n\n`;
        if (previousOutput) {
          prompt += `Synthesized Answer:\n${previousOutput}\n\n`;
        }
        
        prompt += `Review this answer for:\n`;
        prompt += `1. Completeness - Does it fully address all aspects of the question?\n`;
        prompt += `2. Accuracy - Is the information correct based on the SOPs?\n`;
        prompt += `3. Usefulness - Can the user take action based on this guidance?\n`;
        prompt += `4. Clarity - Is the answer well-structured and easy to understand?\n\n`;
        prompt += `Provide the final polished answer and a confidence score (0.0-1.0).`;
        break;
    }

    return prompt;
  }

  /**
   * Extract SOP sources mentioned in the research step
   */
  private async extractSOPSources(researchOutput: string): Promise<string[]> {
    const sopIdPattern = /SOP[_\s-]?(\w+)/gi;
    const matches = researchOutput.match(sopIdPattern) || [];
    const uniqueSOPs = [...new Set(matches.map(match => match.replace(/[_\s-]/g, '')))];
    return uniqueSOPs.slice(0, 5); // Limit to top 5 mentioned SOPs
  }

  /**
   * Execute a single reasoning pass through all steps
   */
  private async executeReasoningPass(
    userQuery: string,
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> | undefined,
    reasoningSteps: string[]
  ): Promise<{
    steps: ChainOfThoughtStep[];
    sopSources: string[];
    finalAnswer: string;
    confidence: number;
  }> {
    const steps: ChainOfThoughtStep[] = [];
    let previousOutput = '';
    let sopSources: string[] = [];
    
    // Execute each configured reasoning step
    for (const stepName of reasoningSteps) {
      if (!this.isValidReasoningStep(stepName)) {
        console.warn(`Invalid reasoning step: ${stepName}, skipping`);
        continue;
      }
      
      const step = await this.executeStage(
        stepName as any,
        userQuery,
        conversationHistory,
        previousOutput
      );
      
      steps.push(step);
      
      // Update previous output for next step
      if (stepName === 'research_sops') {
        sopSources = await this.extractSOPSources(step.response);
        previousOutput = [previousOutput, step.response].filter(Boolean).join('\n\n');
      } else if (stepName === 'synthesize_answer') {
        previousOutput = step.response;
      } else {
        previousOutput = step.response;
      }
    }

    // Extract final answer and confidence from the last step
    const lastStep = steps[steps.length - 1];
    let finalAnswer = '';
    let confidence = 0.5;
    
    if (lastStep) {
      const finalData = await this.extractFinalAnswer(lastStep.response);
      finalAnswer = finalData.answer;
      confidence = finalData.confidence;
    }

    return { steps, sopSources, finalAnswer, confidence };
  }

  /**
   * Check if refinement should be performed
   */
  private shouldRefine(currentConfidence: number, refinementConfig: any): boolean {
    return currentConfidence < refinementConfig.confidence_threshold;
  }

  /**
   * Perform iterative refinement to improve the answer
   */
  private async performIterativeRefinement(
    userQuery: string,
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> | undefined,
    result: ChainOfThoughtResult,
    refinementConfig: any
  ): Promise<void> {
    let currentConfidence = result.confidence_score;
    let iteration = 0;
    
    while (
      iteration < refinementConfig.max_iterations &&
      currentConfidence < refinementConfig.confidence_threshold
    ) {
      const iterationStartTime = Date.now();
      const previousConfidence = currentConfidence;
      
      debugLog('log_chain_of_thought_steps', `Starting refinement iteration ${iteration + 1}`, {
        currentConfidence,
        targetThreshold: refinementConfig.confidence_threshold
      });

      // Execute refinement steps with context from previous iteration
      const refinementContext = this.buildRefinementContext(result, userQuery);
      const refinementResult = await this.executeReasoningPass(
        userQuery,
        [...(conversationHistory || []), { role: 'assistant', content: refinementContext }],
        refinementConfig.refinement_steps
      );

      // Check if confidence improved
      const improvement = refinementResult.confidence - previousConfidence;
      
      if (improvement >= refinementConfig.improvement_threshold) {
        // Accept the refinement
        result.final_answer = refinementResult.finalAnswer;
        result.confidence_score = refinementResult.confidence;
        result.sop_sources = refinementResult.sopSources;
        currentConfidence = refinementResult.confidence;

        // Track this iteration
        result.refinement_iterations?.push({
          iteration: iteration + 1,
          confidence_before: previousConfidence,
          confidence_after: refinementResult.confidence,
          improvement: improvement,
          steps: refinementResult.steps
        });

        debugLog('log_chain_of_thought_steps', `Refinement iteration ${iteration + 1} successful`, {
          improvement,
          newConfidence: currentConfidence
        });
      } else {
        // Refinement didn't improve enough, stop iterating
        debugLog('log_chain_of_thought_steps', `Refinement iteration ${iteration + 1} insufficient improvement`, {
          improvement,
          requiredImprovement: refinementConfig.improvement_threshold
        });
        break;
      }

      iteration++;
      
      // Check timeout
      if (Date.now() - iterationStartTime > refinementConfig.timeout_per_iteration_ms) {
        debugLog('log_chain_of_thought_steps', 'Refinement iteration timeout, stopping');
        break;
      }
    }

    debugLog('log_chain_of_thought_steps', 'Iterative refinement completed', {
      iterations: iteration,
      finalConfidence: currentConfidence,
      totalRefinementSteps: result.refinement_iterations?.length || 0
    });
  }

  /**
   * Build context for refinement iteration
   */
  private buildRefinementContext(result: ChainOfThoughtResult, originalQuery: string): string {
    return `Previous analysis of "${originalQuery}" achieved confidence ${result.confidence_score.toFixed(2)}. 
Current answer: ${result.final_answer}

Please refine this analysis to improve accuracy and completeness.`;
  }

  /**
   * Validate if a reasoning step name is supported
   */
  private isValidReasoningStep(stepName: string): boolean {
    const validSteps = ['analyze_query', 'research_sops', 'synthesize_answer', 'validate_response'];
    return validSteps.includes(stepName);
  }

  /**
   * Extract final answer and confidence from validation step
   */
  private async extractFinalAnswer(validationOutput: string): Promise<{answer: string, confidence: number}> {
    // Try to parse structured response
    const confidenceMatch = validationOutput.match(/confidence[:\s]+([\d.]+)/i);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.8;

    // Look for final answer section
    const answerMatch = validationOutput.match(/final[^:]*answer[:\s]+([\s\S]+?)(?:\n\n|confidence|$)/i);
    const answer = answerMatch ? answerMatch[1].trim() : validationOutput;

    return {
      answer: answer || validationOutput,
      confidence: Math.max(0, Math.min(1, confidence)) // Ensure 0-1 range
    };
  }

  /**
   * Summarize conversation history for context management
   */
  async summarizeConversationHistory(
    history: Array<{role: 'user' | 'assistant', content: string}>,
    responseMode: 'quick' | 'standard' | 'comprehensive' = 'standard'
  ): Promise<string> {
    if (history.length === 0) return '';

    const contextConfig = getContextManagementConfig();
    const maxWords = contextConfig.conversation_history.summary_max_words;

    try {
      const historyText = history.map(msg => 
        `${msg.role.toUpperCase()}: ${msg.content}`
      ).join('\n');

      const modeConfig = getResponseModeConfig(responseMode);
      const defaults = getDefaultsConfig();
      
      // For chain-of-thought modes without LLM, use a default model for summarization
      const summaryModel = modeConfig.llm || defaults.lightweight_model;

      const response = await this.client.chat.completions.create({
        model: summaryModel,
        messages: [{
          role: 'user',
          content: `Summarize this conversation history in ${maxWords} words or less, focusing on key topics and decisions:\n\n${historyText}`
        }],
        temperature: defaults.analytical_temperature  // Use analytical temperature for consistent summaries
      });

      return response.choices[0]?.message?.content || '';

    } catch (error) {
      console.error('Failed to summarize conversation history:', error);
      return 'Previous conversation covered project management topics.';
    }
  }
}

// Export singleton instance
export const chainOfThoughtProcessor = new ChainOfThoughtProcessor();