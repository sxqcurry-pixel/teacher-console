import { Injectable } from '@nestjs/common';
import {
  AIProvider,
  ChatCompletionMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatCompletionStream,
} from './ai.provider';

/**
 * Offline fallback provider — returns deterministic mock content so
 * developers can iterate AI pages without network / API keys.
 */
@Injectable()
export class MockAIProvider extends AIProvider {
  async chat(messages: ChatCompletionMessage[], _opt?: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const last = messages[messages.length - 1]?.content || '';
    const content = `【Mock AI 建议】\n\n收到请求：${last.slice(0, 60)}${last.length > 60 ? '…' : ''}\n\n1. 每天抽 15 分钟做针对性错题复盘，使用"错因 → 思路 → 再练一题"三段法。\n2. 二次函数图像题建议先画草图标注顶点/对称轴，再做代数推导，减少低级失误。\n3. 下次课上优先点名表扬近期进步的学生，强化正向循环。\n\n⚠️  以上为离线 Mock 内容，配置 AI_PROVIDER + API Key 后接入真实大模型。`;
    return { content, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
  }

  chatStream(messages: ChatCompletionMessage[], opt?: ChatCompletionOptions): Promise<ChatCompletionStream> {
    const provider = this;
    async function* gen(): ChatCompletionStream {
      const { content } = await provider.chat(messages, opt);
      for (let i = 0; i < content.length; i += 2) {
        await new Promise((r) => setTimeout(r, 8));
        yield { done: false, content: content.slice(i, i + 2) };
      }
      yield { done: true, content: '', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
    }
    return Promise.resolve(gen());
  }
}
