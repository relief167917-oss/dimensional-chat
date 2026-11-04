import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ZhipuProvider, parseRetryAfter } from '../zhipu.js';

const ok = () => Response.json({ choices: [{ message: { content: '成功' } }] });
beforeEach(() => { vi.stubEnv('ZHIPU_API_KEY', 'retry-test-key'); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }); vi.spyOn(Math, 'random').mockReturnValue(0); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([200, 400, 503])('HTTP %s中的业务码1305都可重试', async (status) => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: '1305' } }, { status })).mockResolvedValueOnce(ok());
  vi.stubGlobal('fetch', fetchMock);
  const pending = new ZhipuProvider().chat([]);
  await vi.advanceTimersByTimeAsync(1500);
  expect(await pending).toHaveProperty('text', '成功'); expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('Retry-After秒数优先于默认退避，返回实际retry等待', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '3' } })).mockResolvedValueOnce(ok());
  vi.stubGlobal('fetch', fetchMock);
  const onRetry = vi.fn(); const pending = new ZhipuProvider().chat([], { onRetry });
  await vi.advanceTimersByTimeAsync(2999); expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); await pending;
  expect(onRetry).toHaveBeenCalledWith({ attempt: 1, waitMs: 3000, code: 'RATE_LIMIT' });
});

it('Retry-After支持HTTP日期，过去日期为0，无效值退回默认策略', () => {
  vi.setSystemTime(new Date('2026-11-04T00:00:00Z'));
  expect(parseRetryAfter('Wed, 04 Nov 2026 00:00:04 GMT')).toBe(4000);
  expect(parseRetryAfter('Tue, 03 Nov 2026 00:00:00 GMT')).toBe(0);
  expect(parseRetryAfter('unknown')).toBeUndefined();
});

it('无Retry-After时退避加0至500ms抖动', async () => {
  vi.mocked(Math.random).mockReturnValue(0.9999);
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 429 })).mockResolvedValueOnce(ok());
  vi.stubGlobal('fetch', fetchMock); const onRetry = vi.fn();
  const pending = new ZhipuProvider().chat([], { onRetry });
  await vi.advanceTimersByTimeAsync(2000); await pending;
  expect(onRetry.mock.calls[0][0].waitMs).toBe(2000);
});

it('预算在Retry-After等待中取消，立即结束且没有第二次请求', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
  vi.stubGlobal('fetch', fetchMock); const controller = new AbortController();
  const pending = new ZhipuProvider().chat([], { signal: controller.signal }).catch((error) => error);
  await vi.advanceTimersByTimeAsync(1000); controller.abort();
  expect(await pending).toHaveProperty('code', 'ABORTED'); expect(fetchMock).toHaveBeenCalledTimes(1);
});
