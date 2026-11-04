import {
  LLMError,
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
  type LLMProvider,
  type TokenUsage,
} from './provider.js';

// 免费型号固定在实现中，不从参数接受其他型号，也不自动切换付费模型。
export const ZHIPU_MODEL = 'glm-4.7-flash';
const ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

function getUsage(value: unknown): TokenUsage | null {
  const usage = value as Record<string, unknown> | undefined;
  const fields = [usage?.prompt_tokens, usage?.completion_tokens, usage?.total_tokens];
  if (!fields.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return null;
  return {
    promptTokens: usage!.prompt_tokens as number,
    completionTokens: usage!.completion_tokens as number,
    totalTokens: usage!.total_tokens as number,
  };
}

export class ZhipuProvider implements LLMProvider {
  readonly name = 'zhipu';

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const key = process.env.ZHIPU_API_KEY?.trim();
    if (!key) {
      throw new LLMError('MISSING_API_KEY', '缺少 ZHIPU_API_KEY，请设置环境变量或填写 server/.env。');
    }
    const timeoutMs = options.timeoutMs ?? 20_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new LLMError('CLIENT_ERROR', 'timeoutMs 必须是正数。');
    }
    const started = performance.now();
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.request(key, messages, options, timeoutMs);
        return { ...result, provider: this.name, latencyMs: Math.round(performance.now() - started) };
      } catch (error) {
        if (!(error instanceof LLMError) || !error.retryable || attempt >= 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }

  private async request(
    key: string,
    messages: ChatMessage[],
    options: ChatOptions,
    timeoutMs: number,
  ): Promise<Pick<ChatResult, 'text' | 'usage'>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        redirect: 'error',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: ZHIPU_MODEL,
          messages,
          thinking: { type: 'disabled' },
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 600,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      // HTTP 状态优先分类，保证非 JSON 的 429 / 5xx 也会重试。
      if (response.status === 429) throw new LLMError('RATE_LIMIT', '智谱请求限流或模型繁忙，请稍后重试。', true, 429);
      if (response.status >= 500) throw new LLMError('SERVER_ERROR', '智谱服务暂时不可用。', true, response.status);

      let data: any;
      try {
        data = await response.json();
      } catch {
        if (controller.signal.aborted) throw new LLMError('TIMEOUT', '智谱请求超时。', true);
        if (!response.ok) throw new LLMError('CLIENT_ERROR', '智谱拒绝请求，请检查密钥和请求参数。', false, response.status);
        throw new LLMError('INVALID_RESPONSE', '智谱返回了无法解析的响应。');
      }
      if (String(data?.error?.code) === '1302') {
        throw new LLMError('RATE_LIMIT', '智谱请求限流，请稍后重试。', true, response.status);
      }
      if (!response.ok || data?.error) {
        throw new LLMError('CLIENT_ERROR', '智谱拒绝请求，请检查密钥、账户权限和请求参数。', false, response.status);
      }
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.trim() === '') {
        throw new LLMError('EMPTY_RESPONSE', '智谱返回的内容为空。');
      }
      return { text, usage: getUsage(data.usage) };
    } catch (error) {
      if (error instanceof LLMError) throw error;
      if (controller.signal.aborted) throw new LLMError('TIMEOUT', '智谱请求超时。', true);
      throw new LLMError('NETWORK_ERROR', '无法连接智谱服务，请检查网络。', true);
    } finally {
      clearTimeout(timer);
    }
  }
}
