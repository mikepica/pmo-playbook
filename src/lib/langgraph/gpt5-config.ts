/**
 * GPT-5 Configuration Helper
 * 
 * Since LangChain JS doesn't yet support GPT-5's reasoning_effort and verbosity parameters,
 * this helper manages behavior through prompt engineering.
 */

export type VerbosityLevel = 'low' | 'medium' | 'high';
export type ReasoningLevel = 'minimal' | 'low' | 'medium' | 'high';

interface GPT5Config {
  verbosity?: VerbosityLevel;
  reasoning?: ReasoningLevel;
}

/**
 * Maps old temperature values to GPT-5 equivalent behavior
 */
export function mapTemperatureToConfig(temperature: number): GPT5Config {
  if (temperature <= 0.2) {
    return { verbosity: 'low', reasoning: 'medium' };
  } else if (temperature <= 0.3) {
    return { verbosity: 'medium', reasoning: 'medium' };
  } else {
    return { verbosity: 'high', reasoning: 'high' };
  }
}

/**
 * Generates verbosity instructions for system prompt
 */
function getVerbosityInstruction(level: VerbosityLevel): string {
  switch (level) {
    case 'low':
      return 'Be concise and direct. Provide brief, focused responses without unnecessary elaboration.';
    case 'medium':
      return 'Provide balanced responses with appropriate detail where needed.';
    case 'high':
      return 'Provide comprehensive, detailed responses with thorough explanations.';
    default:
      return '';
  }
}

/**
 * Generates reasoning instructions for system prompt
 */
function getReasoningInstruction(level: ReasoningLevel): string {
  switch (level) {
    case 'minimal':
      return 'Respond quickly with direct answers.';
    case 'low':
      return 'Apply basic reasoning to provide accurate answers.';
    case 'medium':
      return 'Apply careful analysis and reasoning to ensure accuracy.';
    case 'high':
      return 'Apply thorough, step-by-step reasoning to ensure the highest quality response.';
    default:
      return '';
  }
}

/**
 * Enhances a system prompt with GPT-5 behavior controls
 */
export function getGPT5SystemPrompt(
  basePrompt: string,
  config: GPT5Config = { verbosity: 'medium', reasoning: 'medium' }
): string {
  const verbosityInstruction = getVerbosityInstruction(config.verbosity || 'medium');
  const reasoningInstruction = getReasoningInstruction(config.reasoning || 'medium');
  
  // Combine instructions
  const behaviorInstructions = [
    verbosityInstruction,
    reasoningInstruction
  ].filter(Boolean).join(' ');
  
  // Append to base prompt
  return `${basePrompt}

Response Guidelines: ${behaviorInstructions}`;
}

/**
 * Get model name from environment or default
 */
export function getModelName(): string {
  return process.env.OPENAI_MODEL || 'gpt-5';
}

/**
 * Get default GPT-5 configuration from environment
 */
export function getDefaultConfig(): GPT5Config {
  return {
    verbosity: (process.env.GPT5_VERBOSITY as VerbosityLevel) || 'medium',
    reasoning: (process.env.GPT5_REASONING as ReasoningLevel) || 'medium'
  };
}