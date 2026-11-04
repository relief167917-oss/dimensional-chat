import { LLMError, type ChatMessage, type ChatOptions, type LLMProvider } from './provider.js';
import { ZhipuProvider } from './zhipu.js';

// 新增服务商只需实现 LLMProvider，并按优先级加入此列表。
export const providers: LLMProvider[] = [new ZhipuProvider()];

export async function callLLM(messages: ChatMessage[], options: ChatOptions = {}) {
  let lastError: LLMError = new LLMError('NO_PROVIDER', '没有配置可用的模型服务商。');
  for (const provider of providers) {
    try {
      return await provider.chat(messages, options);
    } catch (error) {
      if (!(error instanceof LLMError) || !error.retryable) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export { LLMError } from './provider.js';
export type { ChatMessage, ChatOptions, ChatResult, LLMProvider, TokenUsage } from './provider.js';
