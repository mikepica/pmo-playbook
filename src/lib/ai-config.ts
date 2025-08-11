import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Type definitions for the configuration
export interface AIModelConfig {
  primary: string;
  summarization: string;
  fallback: string;
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

export interface AIConfig {
  models: AIModelConfig;
  multi_sop: MultiSOPConfig;
  modes: {
    sop_selection: AIModeConfig;
    sop_generation: AIModeConfig;
    general_knowledge: AIModeConfig;
    session_summary: AIModeConfig;
  };
  flow: FlowConfig;
  content: ContentConfig;
  semantic_analysis?: SemanticAnalysisConfig;
  prompts: Record<string, string>;
  environments?: Record<string, Partial<AIConfig>>;
  features: FeatureFlags;
  validation: ValidationConfig;
  debug: DebugConfig;
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
    // Required sections
    const requiredSections = ['models', 'modes', 'flow', 'prompts'];
    for (const section of requiredSections) {
      if (!config[section as keyof AIConfig]) {
        throw new Error(`Missing required configuration section: ${section}`);
      }
    }

    // Required modes
    const requiredModes = ['sop_selection', 'sop_generation', 'general_knowledge', 'session_summary'];
    for (const mode of requiredModes) {
      if (!config.modes[mode as keyof typeof config.modes]) {
        throw new Error(`Missing required mode configuration: ${mode}`);
      }
    }

    // Validate temperature ranges
    for (const [modeName, modeConfig] of Object.entries(config.modes)) {
      if (modeConfig.temperature < 0 || modeConfig.temperature > 2) {
        throw new Error(`Invalid temperature for ${modeName}: ${modeConfig.temperature} (must be 0-2)`);
      }
      if (modeConfig.max_tokens < 1 || modeConfig.max_tokens > 4000) {
        throw new Error(`Invalid max_tokens for ${modeName}: ${modeConfig.max_tokens} (must be 1-4000)`);
      }
    }

    // Validate confidence thresholds
    if (config.flow.confidence_threshold < 0 || config.flow.confidence_threshold > 1) {
      throw new Error(`Invalid confidence_threshold: ${config.flow.confidence_threshold} (must be 0-1)`);
    }

    // Validate multi-SOP settings
    if (config.multi_sop.max_sops_per_query < 1 || config.multi_sop.max_sops_per_query > 5) {
      throw new Error(`Invalid max_sops_per_query: ${config.multi_sop.max_sops_per_query} (must be 1-5)`);
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
    return {
      max_context: config.flow.max_context_tokens,
      max_total: config.validation.max_total_tokens
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