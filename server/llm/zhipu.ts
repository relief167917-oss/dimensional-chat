import {
  LLMError, type ChatMessage, type ChatOptions, type ChatResult, type LLMProvider, type TokenUsage,
} from './provider.js';

export const ZHIPU_MODEL = 'glm-4.7-flash';
const ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const aborted = () => new LLMError('ABORTED', '本轮时间预算已用尽。');

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value.trim())) {
    const milliseconds = Number(value) * 1000;
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  }
  if (value.trim().startsWith('-')) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : undefined;
}

function usageOf(value: unknown): TokenUsage | null {
  const usage = value as Record<string, unknown> | undefined;
  const fields = [usage?.prompt_tokens, usage?.completion_tokens, usage?.total_tokens];
  if (!fields.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return null;
  return { promptTokens: fields[0] as number, completionTokens: fields[1] as number, totalTokens: fields[2] as number };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(aborted()); return; }
    const timer = setTimeout(() => { cleanup(); resolve(); }, Math.min(ms, 2_147_483_647));
    const onAbort = () => { clearTimeout(timer); cleanup(); reject(aborted()); };
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

type Payload = {
  code?: unknown;
  error?: { code?: unknown };
  choices?: { message?: { content?: unknown } }[];
  usage?: unknown;
};

export class ZhipuProvider implements LLMProvider {
  readonly name = 'zhipu';

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const key = process.env.ZHIPU_API_KEY?.trim();
    if (!key) throw new LLMError('MISSING_API_KEY', '缺少 ZHIPU_API_KEY，请设置环境变量或填写 server/.env。');
    const timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new LLMError('CLIENT_ERROR', 'timeoutMs 必须是正数。');
    const started = performance.now();
    for (let attempt = 0; ; attempt++) {
      if (options.signal?.aborted) throw aborted();
      try {
        const result = await this.request(key, messages, options, timeoutMs);
        return { ...result, provider: this.name, latencyMs: Math.round(performance.now() - started) };
      } catch (error) {
        if (!(error instanceof LLMError) || !error.retryable || attempt >= 2) throw error;
        const delay = error.retryAfterMs ?? ([1500, 4000][attempt] + Math.floor(Math.random() * 501));
        const waitStarted = performance.now();
        try { await wait(delay, options.signal); }
        finally {
          options.onRetry?.({ attempt: attempt + 1, waitMs: Math.round(performance.now() - waitStarted), code: error.code });
        }
      }
    }
  }

  private async request(key: string, messages: ChatMessage[], options: ChatOptions, timeoutMs: number): Promise<Pick<ChatResult, 'text' | 'usage'>> {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (options.signal?.aborted) throw aborted();
    options.signal?.addEventListener('abort', forwardAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ZHIPU_MODEL, messages, thinking: { type: 'disabled' },
          temperature: options.temperature ?? 0.7, max_tokens: options.maxTokens ?? 250,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      let data: Payload | null = null;
      try { data = await response.json() as Payload; }
      catch { if (controller.signal.aborted) throw new LLMError('TIMEOUT', '智谱请求超时。', true); }
      const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
      if (response.status === 429 || ['1302', '1305'].includes(String(data?.error?.code ?? data?.code))) {
        throw new LLMError('RATE_LIMIT', '智谱请求限流或模型繁忙，请稍后重试。', true, response.status, retryAfterMs);
      }
      if (response.status >= 500) throw new LLMError('SERVER_ERROR', '智谱服务暂时不可用。', true, response.status, retryAfterMs);
      if (!response.ok || data?.error) throw new LLMError('CLIENT_ERROR', '智谱拒绝请求，请检查密钥、账户权限和请求参数。', false, response.status);
      if (!data) throw new LLMError('INVALID_RESPONSE', '智谱返回了无法解析的响应。');
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new LLMError('EMPTY_RESPONSE', '智谱返回的内容为空。');
      return { text, usage: usageOf(data.usage) };
    } catch (error) {
      if (options.signal?.aborted) throw aborted();
      if (error instanceof LLMError) throw error;
      if (controller.signal.aborted) throw new LLMError('TIMEOUT', '智谱请求超时。', true);
      throw new LLMError('NETWORK_ERROR', '无法连接智谱服务，请检查网络。', true);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', forwardAbort);
    }
  }
}
