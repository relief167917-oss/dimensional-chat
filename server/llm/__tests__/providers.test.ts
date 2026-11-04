import { afterEach, expect, it, vi } from 'vitest';
import { callLLM, providers } from '../index.js';
import { LLMError } from '../provider.js';

const original = [...providers];
afterEach(() => providers.splice(0, providers.length, ...original));

it('当前服务商重试耗尽后，按列表顺序切换下一家', async () => {
  const next = vi.fn().mockResolvedValue({ text: 'ok', usage: null, provider: 'second', latencyMs: 1 });
  providers.splice(0, providers.length,
    { name: 'first', chat: vi.fn().mockRejectedValue(new LLMError('RATE_LIMIT', '限流', true)) },
    { name: 'second', chat: next },
  );
  await expect(callLLM([])).resolves.toHaveProperty('provider', 'second');
  expect(next).toHaveBeenCalledTimes(1);
});

it('不可重试错误不切换服务商', async () => {
  const next = vi.fn();
  providers.splice(0, providers.length,
    { name: 'first', chat: vi.fn().mockRejectedValue(new LLMError('CLIENT_ERROR', '参数错误')) },
    { name: 'second', chat: next },
  );
  await expect(callLLM([])).rejects.toHaveProperty('code', 'CLIENT_ERROR');
  expect(next).not.toHaveBeenCalled();
});
