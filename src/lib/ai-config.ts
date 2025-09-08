import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Essential type definitions
export interface SOPSelectionConfig {
  llm: string;
  selection_method: string;
  min_confidence: number;
  prefer_recent_sops: boolean;
}

export interface ProcessingConfig {
  model: string;
  max_tokens: number;
  max_response_words: number;
}

export interface EscapeHatchConfig {
  trigger_threshold: number;
  message_template: string;
  show_partial_info: boolean;
  request_feedback: boolean;
  feedback_prompt: string;
}

export interface DefaultsConfig {
  primary_model: string;
  lightweight_model: string;
}

export interface FeatureFlags {
  enable_multi_sop: boolean;
  enable_cross_references: boolean;
  enable_conversation_memory: boolean;
  enable_confidence_routing: boolean;
  enable_template_variables: boolean;
  enable_hot_reload: boolean;
}

export interface SessionManagementConfig {
  summary_model: string;
  summary_max_tokens: number;
}

export interface DebugConfig {
  log_token_usage: boolean;
  log_confidence_scores: boolean;
  log_sop_selection_reasoning: boolean;
  save_failed_queries: boolean;
  log_response_modes: boolean;
  log_chain_of_thought_steps: boolean;
  log_context_usage: boolean;
  log_xml_processing: boolean;
  log_coverage_analysis: boolean;
  save_comprehensive_triggers: boolean;
}

export interface SystemConfig {
  processing: ProcessingConfig;
  escape_hatch: EscapeHatchConfig;
  defaults?: DefaultsConfig;
  sop_selection: SOPSelectionConfig;
  session_management?: SessionManagementConfig;
  features: FeatureFlags;
  debug: DebugConfig;
  environments?: Record<string, Partial<SystemConfig>>;
}

export interface PromptsConfig {
  active_prompt_set: string;
  prompt_sets: Record<string, {
    prompts: Record<string, string>;
  }>;
}

export interface AIConfig {
  processing: ProcessingConfig;
  escape_hatch: EscapeHatchConfig;
  defaults?: DefaultsConfig;
  sop_selection: SOPSelectionConfig;
  session_management?: SessionManagementConfig;
  prompts: Record<string, string>;
  features: FeatureFlags;
  debug: DebugConfig;
  environments?: Record<string, Partial<AIConfig>>;
}

class AIConfigManager {
  private static instance: AIConfigManager;
  private config: AIConfig | null = null;
  private systemConfigPath: string;
  private promptsConfigPath: string;
  private lastModified: number = 0;

  private constructor() {
    this.systemConfigPath = path.resolve(process.cwd(), 'ai-system.yaml');
    this.promptsConfigPath = path.resolve(process.cwd(), 'ai-prompts.yaml');
  }

  public static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  public loadConfig(environment?: string): AIConfig {
    try {
      const systemExists = fs.existsSync(this.systemConfigPath);
      const promptsExists = fs.existsSync(this.promptsConfigPath);

      if (!systemExists || !promptsExists) {
        throw new Error('Required configuration files not found: ai-system.yaml and ai-prompts.yaml');
      }

      return this.loadSplitConfig(environment);
    } catch (error) {
      console.error('Failed to load AI configuration:', error);
      throw new Error(`AI configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private loadSplitConfig(environment?: string): AIConfig {
    const systemStats = fs.statSync(this.systemConfigPath);
    const promptsStats = fs.statSync(this.promptsConfigPath);
    const currentModified = Math.max(systemStats.mtime.getTime(), promptsStats.mtime.getTime());

    if (!this.config || currentModified > this.lastModified) {
      console.log('Loading AI configuration...');
      
      const systemContents = fs.readFileSync(this.systemConfigPath, 'utf8');
      const systemConfig = yaml.load(systemContents) as SystemConfig;
      
      const promptsContents = fs.readFileSync(this.promptsConfigPath, 'utf8');
      const promptsConfig = yaml.load(promptsContents) as PromptsConfig;
      
      this.config = this.mergeSplitConfigs(systemConfig, promptsConfig);
      
      if (environment && systemConfig.environments?.[environment]) {
        this.config = this.mergeEnvironmentConfig(this.config, environment, systemConfig.environments[environment]);
      }

      this.validateConfig(this.config);
      this.lastModified = currentModified;
      console.log('AI configuration loaded successfully');
    }

    return this.config;
  }

  private mergeSplitConfigs(systemConfig: SystemConfig, promptsConfig: PromptsConfig): AIConfig {
    const activePromptSet = promptsConfig.active_prompt_set || 'default';
    const activePrompts = promptsConfig.prompt_sets[activePromptSet];
    
    if (!activePrompts) {
      throw new Error(`Active prompt set '${activePromptSet}' not found in prompts configuration`);
    }

    return {
      processing: systemConfig.processing,
      escape_hatch: systemConfig.escape_hatch,
      defaults: systemConfig.defaults,
      sop_selection: systemConfig.sop_selection,
      session_management: systemConfig.session_management,
      prompts: activePrompts.prompts,
      features: systemConfig.features,
      debug: systemConfig.debug,
      environments: systemConfig.environments as Record<string, Partial<AIConfig>>
    };
  }

  private mergeEnvironmentConfig(baseConfig: AIConfig, environment: string, envConfig?: Partial<SystemConfig>): AIConfig {
    const envOverrides = envConfig || baseConfig.environments?.[environment];
    if (!envOverrides) return baseConfig;

    return this.deepMerge(baseConfig, envOverrides) as AIConfig;
  }

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

  private validateConfig(config: AIConfig): void {
    const requiredSections = ['processing', 'escape_hatch', 'prompts'];
    for (const section of requiredSections) {
      if (!config[section as keyof AIConfig]) {
        throw new Error(`Missing required configuration section: ${section}`);
      }
    }

    if (config.processing) {
      if (config.processing.max_tokens < 100 || config.processing.max_tokens > 4000) {
        throw new Error(`Invalid max_tokens: ${config.processing.max_tokens} (must be 100-4000)`);
      }
    }

    if (config.escape_hatch) {
      if (config.escape_hatch.trigger_threshold < 0 || config.escape_hatch.trigger_threshold > 1) {
        throw new Error(`Invalid escape_hatch trigger_threshold: ${config.escape_hatch.trigger_threshold} (must be 0-1)`);
      }
    }
  }

  public getConfig(): AIConfig {
    if (!this.config) {
      return this.loadConfig(process.env.NODE_ENV || 'development');
    }
    return this.config;
  }

  public getPrompt(promptName: string): string {
    const config = this.getConfig();
    const prompt = config.prompts[promptName];
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptName}`);
    }
    return prompt;
  }

  public isFeatureEnabled(featureName: keyof FeatureFlags): boolean {
    const config = this.getConfig();
    return config.features[featureName] === true;
  }

  public debugLog(category: keyof DebugConfig, message: string, data?: any): void {
    const config = this.getConfig();
    if (config.debug[category]) {
      console.log(`🔍 [AI-${category.toUpperCase()}] ${message}`, data || '');
    }
  }

  public reloadConfig(): AIConfig {
    this.config = null;
    this.lastModified = 0;
    return this.loadConfig(process.env.NODE_ENV || 'development');
  }
}

// Export singleton instance
export const aiConfig = AIConfigManager.getInstance();

// Convenience functions
export const getAIConfig = () => aiConfig.getConfig();
export const getPrompt = (name: string) => aiConfig.getPrompt(name);
export const isFeatureEnabled = (feature: keyof FeatureFlags) => aiConfig.isFeatureEnabled(feature);
export const debugLog = (category: keyof DebugConfig, message: string, data?: any) => 
  aiConfig.debugLog(category, message, data);

export const getProcessingConfig = () => {
  const config = aiConfig.getConfig();
  return config.processing;
};

export const getEscapeHatchConfig = () => {
  const config = aiConfig.getConfig();
  return config.escape_hatch;
};

export const getDefaultsConfig = () => {
  const config = aiConfig.getConfig();
  return config.defaults || {
    primary_model: 'gpt-5',
    lightweight_model: 'gpt-5'
  };
};

export const getSOPSelectionConfig = () => {
  const config = aiConfig.getConfig();
  return config.sop_selection;
};

export const getSessionManagementConfig = () => {
  const config = aiConfig.getConfig();
  const defaults = getDefaultsConfig();
  if (!config.session_management) {
    // Return defaults if not configured
    return {
      summary_model: defaults.lightweight_model,
      summary_max_tokens: 20
    };
  }
  return config.session_management;
};