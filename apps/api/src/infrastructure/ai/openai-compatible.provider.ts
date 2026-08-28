import { Injectable } from '@nestjs/common';
import OpenAI, { ClientOptions } from 'openai';
import type { ConfigType } from '@nestjs/config';
import type { AIProviderConfig } from '../../config/ai.config';
import {
  AIProvider,
  ChatCompletionMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatCompletionStream,
} from './ai.provider';

/**
 * OpenAI-compatible provider — works with Doubao / Qwen / OpenAI directly,
 * since they all expose OpenAI-compatible REST endpoints (configurable baseURL).
 */
@Injectable()
export class OpenAICompatibleProvider extends AIProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(cfg: AIProviderConfig) {
    super();
    if (!cfg.apiKey) throw new Error(`${cfg.provider} API key is not configured`);
    const opts: ClientOptions = {
      apiKey: cfg.apiKey,
      baseURL: cfg.baseUrl,
    };
    this.client = new OpenAI(opts);
    this.model = cfg.model || 'gpt-4o-mini';
    this.defaultTemperature = cfg.temperature;
    this.defaultMaxTokens = cfg.maxTokens;
  }

  async chat(
    messages: ChatCompletionMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options?.temperature ?? this.defaultTemperature,
      max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      stream: false,
    });
    return {
      content: res.choices[0]?.message.content ?? '',
      usage: res.usage
        ? {
            promptTokens: res.usage.prompt_tokens,
            completionTokens: res.usage.completion_tokens,
            totalTokens: res.usage.total_tokens,
          }
        : undefined,
    };
  }

  chatStream(
    messages: ChatCompletionMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionStream> {
    const client = this.client;
    const model = this.model;
    const t = options?.temperature ?? this.defaultTemperature;
    const m = options?.maxTokens ?? this.defaultMaxTokens;

    async function* gen(): ChatCompletionStream {
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: t,
        max_tokens: m,
        stream: true,
        stream_options: { include_usage: true },
      });

      let usage: ChatCompletionResult['usage'] | undefined;
      for await (const chunk of stream) {
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
        const delta = chunk.choices[0]?.delta.content ?? '';
        if (delta) {
          yield { done: false, content: delta };
        }
      }
      yield { done: true, content: '', usage };
    }
    return Promise.resolve(gen());
  }
}
