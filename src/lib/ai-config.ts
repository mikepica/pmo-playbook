import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Type definitions for the configuration

export interface RefinementConfig {
  enabled: boolean;
  max_iterations: number;
  refinement_steps: string[];
  confidence_threshold: number;
  improvement_threshold: number;
  timeout_per_iteration_ms: number;
}

export interface ResponseModeConfig {
  name: string;
  description: string;
  llm?: string;  // Optional - only required for non-chain-of-thought modes
  max_response_words: number;
  max_tokens?: number;  // Optional - for OpenAI API calls
  temperature?: number;  // Optional - only required for non-chain-of-thought modes
  chain_of_thought: boolean;
  reasoning_steps?: string[];
  refinement?: RefinementConfig;
}

export interface ChainOfThoughtStage {
  description: string;
  llm: string;
  temperature: number;
}

export interface ChainOfThoughtConfig {
  enabled: boolean;
  stages: {
    analyze_query: ChainOfThoughtStage;
    research_sops: ChainOfThoughtStage;
    synthesize_answer: ChainOfThoughtStage;
    validate_response: ChainOfThoughtStage;
  };
}

export interface SOPDirectoryConfig {
  auto_generate: boolean;
  directory_file: string;
  include_topics: boolean;
  include_relationships: boolean;
  include_summaries: boolean;
  include_keywords: boolean;
  editable_in_admin: boolean;
  update_on_sop_create: boolean;
  update_on_sop_edit: boolean;
  update_on_sop_delete: boolean;
}

export interface ContextManagementConfig {
  conversation_history: {
    max_messages: number;
    summarize_older: boolean;
    summary_max_words: number;
  };
  token_limits: {
    soft_limit: number;
    hard_limit: number;
    warning_threshold: number;
  };
  overflow_strategy: {
    method: string;
    priority_order: string[];
  };
  progressive_expansion: {
    enabled: boolean;
    initial_sops: number;
    max_expansion_sops: number;
    expansion_threshold: number;
  };
}

export interface FeedbackSystemConfig {
  auto_comprehensive_on_thumbs_down: boolean;
  confidence_thresholds: {
    high: number;
    medium: number;
    low: number;
  };
  auto_suggest_comprehensive: boolean;
}

export interface MultiSOPConfig {
  enabled: boolean;
  max_sops_per_query: number;
  min_relevance_score: number;
  combination_strategy: 'hierarchical' | 'equal_weight' | 'primary_focused' | 'semantic_weighted';
  allow_cross_references: boolean;
  overlap_handling: 'merge' | 'dedupe' | 'separate' | 'intelligent';
  relationship_detection?: boolean;
  context_merging?: 'smart' | 'simple';
}

export interface AIModeConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  user_prompt_template: string;
  strategy?: 'single_select' | 'multi_select';
  scoring_algorithm?: string;
  combination_method?: 'synthesized' | 'sequential' | 'layered';
  expertise_areas?: string[];
}

export interface FlowConfig {
  confidence_threshold: number;
  conversation_history_limit: number;
  fallback_to_general: boolean;
  enable_cross_topic_queries: boolean;
  max_context_tokens: number;
  routing: {
    prefer_multi_sop: boolean;
    general_knowledge_threshold: number;
  };
}

export interface ContentConfig {
  sop_context_fields: string[];
  include_cross_references: boolean;
  show_topic_relationships: boolean;
  add_best_practices: boolean;
  use_parser_metadata?: boolean;
  deduplicate_content?: boolean;
  merge_similar_sections?: boolean;
}

export interface SemanticAnalysisConfig {
  enabled: boolean;
  use_quality_scores: boolean;
  format_aware: boolean;
  relationship_threshold: number;
  topic_clustering: boolean;
  content_similarity_threshold: number;
}

export interface ValidationConfig {
  max_total_tokens: number;
  min_confidence_score: number;
  max_conversation_history: number;
  required_sop_fields: string[];
}

export interface DebugConfig {
  log_token_usage: boolean;
  log_confidence_scores: boolean;
  log_sop_selection_reasoning: boolean;
  save_failed_queries: boolean;
  log_response_modes: boolean;
  log_chain_of_thought_steps: boolean;
  log_context_usage: boolean;
}

export interface FeatureFlags {
  enable_multi_sop: boolean;
  enable_cross_references: boolean;
  enable_conversation_memory: boolean;
  enable_confidence_routing: boolean;
  enable_template_variables: boolean;
  enable_hot_reload: boolean;
}

export interface SOPSelectionResult {
  strategy: 'multi_sop' | 'single_sop' | 'general_knowledge';
  selectedSops: Array<{
    sopId: string;
    confidence: number;
    role: 'primary' | 'supporting' | 'reference';
    reasoning: string;
  }>;
  overallConfidence: number;
  reasoning: string;
}

export interface SOPGenerationResult {
  answer: string;
  sopSources: Array<{
    sopId: string;
    contribution: string;
  }>;
  crossReferences: Array<{
    relationship: 'depends_on' | 'leads_to' | 'complements';
    description: string;
  }>;
}

export interface GeneralKnowledgeResult {
  answer: string;
  methodologies: string[];
  recommendedTools: string[];
  bestPractices: string[];
}

export interface SOPSelectionConfig {
  llm: string;
  selection_method: string;
  min_confidence: number;
  prefer_recent_sops: boolean;
  multi_sop: MultiSOPConfig;
}

export interface AIConfig {
  response_modes: {
    quick: ResponseModeConfig;
    standard: ResponseModeConfig;
    comprehensive: ResponseModeConfig;
  };
  default_response_mode: string;
  chain_of_thought: ChainOfThoughtConfig;
  sop_directory: SOPDirectoryConfig;
  context_management: ContextManagementConfig;
  feedback_system: FeedbackSystemConfig;
  sop_selection: SOPSelectionConfig;
  prompts: Record<string, string>;
  features: FeatureFlags;
  debug: DebugConfig;
  environments?: Record<string, Partial<AIConfig>>;
  
  // Legacy support - these will be deprecated
  models?: any; // For backward compatibility
  multi_sop?: MultiSOPConfig;
  modes?: {
    sop_selection: AIModeConfig;
    sop_generation: AIModeConfig;
    general_knowledge: AIModeConfig;
    session_summary: AIModeConfig;
  };
  flow?: FlowConfig;
  content?: ContentConfig;
  semantic_analysis?: SemanticAnalysisConfig;
  validation?: ValidationConfig;
}

class AIConfigManager {
  private static instance: AIConfigManager;
  private config: AIConfig | null = null;
  private configPath: string;
  private lastModified: number = 0;

  private constructor() {
    this.configPath = path.resolve(process.cwd(), 'ai-config.yaml');
  }

  public static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  /**
   * Load and parse the AI configuration file
   */
  public loadConfig(environment?: string): AIConfig {
    try {
      const stats = fs.statSync(this.configPath);
      const currentModified = stats.mtime.getTime();

      // Check if we need to reload (file changed or first load)
      if (!this.config || currentModified > this.lastModified) {
        console.log('🔄 Loading AI configuration...');
        
        const fileContents = fs.readFileSync(this.configPath, 'utf8');
        const rawConfig = yaml.load(fileContents) as AIConfig;
        
        // Process variable interpolations
        this.config = this.processVariables(rawConfig);
        
        // Apply environment overrides
        if (environment && this.config.environments?.[environment]) {
          this.config = this.mergeEnvironmentConfig(this.config, environment);
        }

        // Validate configuration
        this.validateConfig(this.config);
        
        this.lastModified = currentModified;
        console.log('✅ AI configuration loaded successfully');
      }

      return this.config;
    } catch (error) {
      console.error('❌ Failed to load AI configuration:', error);
      throw new Error(`AI configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process variable interpolations like {{models.primary}}
   */
  private processVariables(config: any): AIConfig {
    const processed = JSON.parse(JSON.stringify(config));
    
    const interpolate = (obj: any, context: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace(/\{\{([^}]+)\}\}/g, (match: string, path: string) => {
            return this.getNestedValue(context, path) || match;
          });
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          interpolate(obj[key], context);
        }
      }
    };

    interpolate(processed, processed);
    return processed;
  }

  /**
   * Get nested object value by dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Merge environment-specific configuration
   */
  private mergeEnvironmentConfig(baseConfig: AIConfig, environment: string): AIConfig {
    const envConfig = baseConfig.environments?.[environment];
    if (!envConfig) return baseConfig;

    return this.deepMerge(baseConfig, envConfig) as AIConfig;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Validate the configuration structure and values
   */
  private validateConfig(config: AIConfig): void {
    // Required sections for new configuration structure
    const requiredSections = ['response_modes', 'prompts'];
    for (const section of requiredSections) {
      if (!config[section as keyof AIConfig]) {
        throw new Error(`Missing required configuration section: ${section}`);
      }
    }

    // Required response modes
    const requiredResponseModes = ['quick', 'standard', 'comprehensive'];
    for (const mode of requiredResponseModes) {
      if (!config.response_modes?.[mode as keyof typeof config.response_modes]) {
        throw new Error(`Missing required response mode configuration: ${mode}`);
      }
    }

    // Validate temperature ranges for response modes
    if (config.response_modes) {
      for (const [modeName, modeConfig] of Object.entries(config.response_modes)) {
        if (modeConfig.temperature !== undefined && (modeConfig.temperature < 0 || modeConfig.temperature > 2)) {
          throw new Error(`Invalid temperature for ${modeName}: ${modeConfig.temperature} (must be 0-2)`);
        }
      }
    }

    // Validate legacy modes if they exist (for backward compatibility)
    if (config.modes) {
      for (const [modeName, modeConfig] of Object.entries(config.modes)) {
        if (modeConfig.temperature !== undefined && (modeConfig.temperature < 0 || modeConfig.temperature > 2)) {
          throw new Error(`Invalid temperature for ${modeName}: ${modeConfig.temperature} (must be 0-2)`);
        }
        if (modeConfig.max_tokens < 1 || modeConfig.max_tokens > 4000) {
          throw new Error(`Invalid max_tokens for ${modeName}: ${modeConfig.max_tokens} (must be 1-4000)`);
        }
      }
    }

    // Validate temperature ranges for response modes (skip validation for modes without temperature)
    if (config.response_modes) {
      for (const [modeName, modeConfig] of Object.entries(config.response_modes)) {
        if (modeConfig.temperature !== undefined && (modeConfig.temperature < 0 || modeConfig.temperature > 2)) {
          throw new Error(`Invalid temperature for response mode ${modeName}: ${modeConfig.temperature} (must be 0-2)`);
        }
      }
    }

    // Validate legacy flow settings if they exist
    if (config.flow?.confidence_threshold !== undefined) {
      if (config.flow.confidence_threshold < 0 || config.flow.confidence_threshold > 1) {
        throw new Error(`Invalid confidence_threshold: ${config.flow.confidence_threshold} (must be 0-1)`);
      }
    }

    // Validate legacy multi-SOP settings if they exist
    if (config.multi_sop?.max_sops_per_query !== undefined) {
      if (config.multi_sop.max_sops_per_query < 1 || config.multi_sop.max_sops_per_query > 5) {
        throw new Error(`Invalid max_sops_per_query: ${config.multi_sop.max_sops_per_query} (must be 1-5)`);
      }
    }
  }

  /**
   * Get a specific prompt by name
   */
  public getPrompt(promptName: string): string {
    const config = this.getConfig();
    const prompt = config.prompts[promptName];
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptName}`);
    }
    return prompt;
  }

  /**
   * Get mode configuration by name
   */
  public getModeConfig(modeName: string): AIModeConfig {
    const config = this.getConfig();
    if (!config.modes) {
      throw new Error(`Legacy modes configuration not available. Use response modes instead.`);
    }
    const modeConfig = config.modes[modeName as keyof typeof config.modes];
    if (!modeConfig) {
      throw new Error(`Mode configuration not found: ${modeName}`);
    }
    return modeConfig;
  }

  /**
   * Get current configuration (load if not already loaded)
   */
  public getConfig(): AIConfig {
    if (!this.config) {
      return this.loadConfig(process.env.NODE_ENV || 'development');
    }
    return this.config;
  }

  /**
   * Force reload configuration (useful for hot-reload in development)
   */
  public reloadConfig(): AIConfig {
    this.config = null;
    this.lastModified = 0;
    return this.loadConfig(process.env.NODE_ENV || 'development');
  }

  /**
   * Check if hot-reload is enabled and file has changed
   */
  public checkForUpdates(): boolean {
    const config = this.getConfig();
    if (!config.features.enable_hot_reload || process.env.NODE_ENV === 'production') {
      return false;
    }

    try {
      const stats = fs.statSync(this.configPath);
      return stats.mtime.getTime() > this.lastModified;
    } catch {
      return false;
    }
  }

  /**
   * Get token limits for context management
   */
  public getTokenLimits(): { max_context: number; max_total: number } {
    const config = this.getConfig();
    
    // Use new context management if available, fallback to legacy
    if (config.context_management?.token_limits) {
      return {
        max_context: config.context_management.token_limits.soft_limit,
        max_total: config.context_management.token_limits.hard_limit
      };
    }
    
    // Fallback to legacy configuration if available
    return {
      max_context: config.flow?.max_context_tokens || 6000,
      max_total: config.validation?.max_total_tokens || 8000
    };
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(featureName: keyof FeatureFlags): boolean {
    const config = this.getConfig();
    return config.features[featureName] === true;
  }

  /**
   * Log debug information if enabled
   */
  public debugLog(category: keyof DebugConfig, message: string, data?: any): void {
    const config = this.getConfig();
    if (config.debug[category]) {
      console.log(`🔍 [AI-${category.toUpperCase()}] ${message}`, data || '');
    }
  }

  /**
   * Get response mode configuration
   */
  public getResponseModeConfig(mode: 'quick' | 'standard' | 'comprehensive'): ResponseModeConfig {
    const config = this.getConfig();
    const modeConfig = config.response_modes?.[mode];
    if (!modeConfig) {
      throw new Error(`Response mode not found: ${mode}`);
    }
    return modeConfig;
  }

  /**
   * Get chain-of-thought configuration
   */
  public getChainOfThoughtConfig(): ChainOfThoughtConfig {
    const config = this.getConfig();
    if (!config.chain_of_thought) {
      throw new Error('Chain of thought configuration not found');
    }
    return config.chain_of_thought;
  }

  /**
   * Get SOP directory configuration
   */
  public getSOPDirectoryConfig(): SOPDirectoryConfig {
    const config = this.getConfig();
    if (!config.sop_directory) {
      throw new Error('SOP directory configuration not found');
    }
    return config.sop_directory;
  }

  /**
   * Get context management configuration
   */
  public getContextManagementConfig(): ContextManagementConfig {
    const config = this.getConfig();
    if (!config.context_management) {
      throw new Error('Context management configuration not found');
    }
    return config.context_management;
  }

  /**
   * Get feedback system configuration
   */
  public getFeedbackSystemConfig(): FeedbackSystemConfig {
    const config = this.getConfig();
    if (!config.feedback_system) {
      throw new Error('Feedback system configuration not found');
    }
    return config.feedback_system;
  }


  /**
   * Get SOP selection configuration
   */
  public getSOPSelectionConfig(): SOPSelectionConfig {
    const config = this.getConfig();
    if (!config.sop_selection) {
      throw new Error('SOP selection configuration not found');
    }
    return config.sop_selection;
  }

  /**
   * Get default response mode
   */
  public getDefaultResponseMode(): 'quick' | 'standard' | 'comprehensive' {
    const config = this.getConfig();
    const defaultMode = config.default_response_mode || 'standard';
    if (!['quick', 'standard', 'comprehensive'].includes(defaultMode)) {
      console.warn(`Invalid default response mode: ${defaultMode}, falling back to standard`);
      return 'standard';
    }
    return defaultMode as 'quick' | 'standard' | 'comprehensive';
  }

  /**
   * Check if chain of thought is enabled for a response mode
   */
  public isChainOfThoughtEnabled(mode?: 'quick' | 'standard' | 'comprehensive'): boolean {
    const config = this.getConfig();
    if (!config.chain_of_thought?.enabled) return false;
    
    if (mode) {
      const modeConfig = this.getResponseModeConfig(mode);
      return modeConfig.chain_of_thought;
    }
    
    return true;
  }
}

// Export singleton instance
export const aiConfig = AIConfigManager.getInstance();

// Convenience functions
export const getAIConfig = () => aiConfig.getConfig();
export const getPrompt = (name: string) => aiConfig.getPrompt(name);
export const getModeConfig = (mode: string) => aiConfig.getModeConfig(mode);
export const isFeatureEnabled = (feature: keyof FeatureFlags) => aiConfig.isFeatureEnabled(feature);
export const debugLog = (category: keyof DebugConfig, message: string, data?: any) => 
  aiConfig.debugLog(category, message, data);

// New convenience functions for updated configuration
export const getResponseModeConfig = (mode: 'quick' | 'standard' | 'comprehensive') => 
  aiConfig.getResponseModeConfig(mode);
export const getChainOfThoughtConfig = () => aiConfig.getChainOfThoughtConfig();
export const getSOPDirectoryConfig = () => aiConfig.getSOPDirectoryConfig();
export const getContextManagementConfig = () => aiConfig.getContextManagementConfig();
export const getFeedbackSystemConfig = () => aiConfig.getFeedbackSystemConfig();
export const getSOPSelectionConfig = () => aiConfig.getSOPSelectionConfig();
export const getDefaultResponseMode = () => aiConfig.getDefaultResponseMode();
export const isChainOfThoughtEnabled = (mode?: 'quick' | 'standard' | 'comprehensive') => 
  aiConfig.isChainOfThoughtEnabled(mode);