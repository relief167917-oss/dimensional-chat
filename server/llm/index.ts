import { LLMError, type ChatMessage, type ChatOptions, type ChatResult, type LLMProvider } from './provider.js';
import { ZhipuProvider } from './zhipu.js';

// 新增服务商只需实现 LLMProvider，并按优先级加入此列表。
export const providers: LLMProvider[] = [new ZhipuProvider()];

// 导出接口可能被前端同时触发；所有逻辑调用共用串行队列，退避期间也不并发。
let queue: Promise<void> = Promise.resolve();
export function callLLM(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
  const result = queue.then(() => callProviders(messages, options));
  queue = result.then(() => undefined, () => undefined);
  return result;
}

async function callProviders(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
  if (options.signal?.aborted) throw new LLMError('ABORTED', '本轮时间预算已用尽。');
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
