import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMError } from '../provider.js';
import { ZhipuProvider } from '../zhipu.js';

const fakeKey = 'unit-test-key-never-use-in-production';
const messages = [{ role: 'user' as const, content: '你好' }];
const success = () => Response.json({
  choices: [{ message: { content: '{"text":"你好"}' } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

describe('ZhipuProvider', () => {
  beforeEach(() => {
    vi.stubEnv('ZHIPU_API_KEY', fakeKey);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('默认每次 20 秒超时；在 1 秒、2 秒退避后最多再试两次', async () => {
    const fetchMock = vi.fn((_url, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = new ZhipuProvider().chat(messages).catch((error) => error);
    await vi.advanceTimersByTimeAsync(63_000);
    const error = await pending;
    expect(error).toBeInstanceOf(LLMError);
    expect(error.code).toBe('TIMEOUT');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('429 后等待 1 秒重试成功，锁定免费型号并关闭思考', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('限流', { status: 429 })).mockResolvedValueOnce(success());
    vi.stubGlobal('fetch', fetchMock);
    const pending = new ZhipuProvider().chat(messages, { jsonMode: true, temperature: 0.95, maxTokens: 123 });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toMatchObject({ model: 'glm-4.7-flash', thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, temperature: 0.95, max_tokens: 123 });
    expect(result).toMatchObject({ provider: 'zhipu', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } });
  });

  it('HTTP 400 中的智谱 1302 也归为限流并重试', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: '1302' } }, { status: 400 })).mockResolvedValueOnce(success());
    vi.stubGlobal('fetch', fetchMock);
    const pending = new ZhipuProvider().chat(messages);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toHaveProperty('text', '{"text":"你好"}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('非 JSON 的 5xx 也重试，最多三次请求', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('Bad gateway', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = new ZhipuProvider().chat(messages).catch((error) => error);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toMatchObject({ code: 'SERVER_ERROR', retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('普通 4xx 不重试，服务商回显密钥也不会进入异常', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: { message: `invalid Bearer ${fakeKey}` } }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await new ZhipuProvider().chat(messages).catch((error) => error);
    expect(error).toMatchObject({ code: 'CLIENT_ERROR', retryable: false, status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(`${error.message}\n${error.stack}\n${JSON.stringify(error)}`).not.toContain(fakeKey);
    expect(error.cause).toBeUndefined();
  });

  it('底层网络异常包含密钥时，仍只抛出固定的安全文案', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`request headers: Bearer ${fakeKey}`)));
    const pending = new ZhipuProvider().chat(messages).catch((error) => error);
    await vi.advanceTimersByTimeAsync(3000);
    const error = await pending;
    expect(error.code).toBe('NETWORK_ERROR');
    expect(`${error.message}\n${error.stack}\n${JSON.stringify(error)}`).not.toContain(fakeKey);
  });

  it('空内容有明确分类，不当作成功', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '  ' } }] })));
    await expect(new ZhipuProvider().chat(messages)).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
  });

  it('缺少密钥时不发送网络请求', async () => {
    vi.stubEnv('ZHIPU_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(new ZhipuProvider().chat(messages)).rejects.toMatchObject({ code: 'MISSING_API_KEY' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
