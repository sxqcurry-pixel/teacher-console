import { registerAs } from '@nestjs/config';

export type AIProviderName = 'mock' | 'doubao' | 'qwen' | 'openai';

export interface AIProviderConfig {
  provider: AIProviderName;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature: number;
  maxTokens: number;
}

export const aiConfig = registerAs<AIProviderConfig>('ai', (): AIProviderConfig => {
  const provider = (process.env.AI_PROVIDER || 'mock') as AIProviderName;
  const map: Record<AIProviderName, Partial<AIProviderConfig>> = {
    mock: {},
    doubao: {
      apiKey: process.env.DOUBAO_API_KEY,
      baseUrl: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      model: process.env.DOUBAO_MODEL || 'doubao-lite-4k',
    },
    qwen: {
      apiKey: process.env.QWY_API_KEY,
      baseUrl: process.env.QWY_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: process.env.QWY_MODEL || 'qwen-plus',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
  };
  return {
    provider,
    temperature: Number(process.env.AI_TEMPERATURE) || 0.7,
    maxTokens: Number(process.env.AI_MAX_TOKENS) || 2048,
    ...map[provider],
  };
});
