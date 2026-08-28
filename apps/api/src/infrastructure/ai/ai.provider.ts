/**
 * AI Provider abstraction — allows swapping Doubao / Qwen / OpenAI / Mock
 * without touching feature modules. Exposed as Global via AiModule below.
 */
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/** Iterable stream chunk used by controllers for SSE/websocket streaming. */
export type ChatCompletionStream = AsyncIterable<{
  done: boolean;
  content: string;
  usage?: ChatCompletionResult['usage'];
}>;

export abstract class AIProvider {
  abstract chat(
    messages: ChatCompletionMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult>;

  abstract chatStream(
    messages: ChatCompletionMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionStream>;
}
