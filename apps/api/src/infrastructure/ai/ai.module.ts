import { Global, Module, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { aiConfig, AIProviderName } from '../../config/ai.config';
import { AIProvider } from './ai.provider';
import { MockAIProvider } from './mock-ai.provider';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

const OPENAI_BASED: AIProviderName[] = ['doubao', 'qwen', 'openai'];

/**
 * Global AI module. Injects a single `AIProvider` concrete class
 * based on `AI_PROVIDER` env var. Defaults to Mock for a "works out of the box" DX.
 */
@Global()
@Module({
  providers: [
    {
      provide: AIProvider,
      useFactory: (cfg: ConfigType<typeof aiConfig>): AIProvider => {
        Logger.log(`AI provider selected: ${cfg.provider}`, AiModule.name);
        if (cfg.provider === 'mock' || !cfg.apiKey) {
          return new MockAIProvider();
        }
        if (OPENAI_BASED.includes(cfg.provider)) {
          return new OpenAICompatibleProvider(cfg);
        }
        Logger.warn(`Unknown AI_PROVIDER "${cfg.provider}", falling back to mock`, AiModule.name);
        return new MockAIProvider();
      },
      inject: [aiConfig.KEY],
    },
  ],
  exports: [AIProvider],
})
export class AiModule {}
