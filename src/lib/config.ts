// src/lib/config.ts
interface AppConfig {
  // API Configuration
  apiUrl: string;

  // OpenAI Configuration
  openaiApiKey: string;
  openaiModel: string;

  // GPT-5 Configuration
  gpt5Verbosity: string;
  gpt5Reasoning: string;

  // LangGraph Configuration
  enableLangGraphProcessor: boolean;

  // LangChain Configuration
  langchainApiKey: string;
  langchainProject: string;
  langchainEndpoint: string;

  // Redis Configuration
  redisUrl: string;

  // Feature Flags
  enableVectorSearch: boolean;
  enableLangsmithTracing: boolean;
}

// Centralized configuration
export const config: AppConfig = {
  // API Configuration
  apiUrl: process.env.API_URL || 'http://localhost:3000',

  // OpenAI Configuration
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5',

  // GPT-5 Configuration
  gpt5Verbosity: process.env.GPT5_VERBOSITY || 'medium',
  gpt5Reasoning: process.env.GPT5_REASONING || 'medium',

  // LangGraph Configuration
  enableLangGraphProcessor: process.env.ENABLE_LANGGRAPH_PROCESSOR === 'true',

  // LangChain Configuration
  langchainApiKey: process.env.LANGCHAIN_API_KEY || '',
  langchainProject: process.env.LANGCHAIN_PROJECT || 'pmo-playbook',
  langchainEndpoint: process.env.LANGCHAIN_ENDPOINT || 'https://api.smith.langchain.com',

  // Redis Configuration
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Feature Flags
  enableVectorSearch: process.env.ENABLE_VECTOR_SEARCH === 'true',
  enableLangsmithTracing: process.env.ENABLE_LANGSMITH_TRACING !== 'false', // Default to true
};

// Validation helper
export const validateConfig = () => {
  const requiredVars = [
    { key: 'openaiApiKey', value: config.openaiApiKey, name: 'OPENAI_API_KEY' },
  ];

  const missing = requiredVars.filter(v => !v.value);

  if (missing.length > 0) {
    const names = missing.map(v => v.name).join(', ');
    throw new Error(`Missing required environment variables: ${names}`);
  }
};
