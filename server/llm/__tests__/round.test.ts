import { expect, it, vi } from 'vitest';
import { loadCharacters } from '../../characters/index.js';
import { fillTemplate } from '../../prompts/index.js';
import { parseDirectorPlan, runRound } from '../../scripts/round.js';
import type { callLLM, ChatResult } from '../index.js';

function result(text: string): ChatResult {
  return { text, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, provider: 'mock', latencyMs: 1 };
}
const first = { speaker: 'sun_wukong', reply_to: 'user_1', intent: '调侃拖延', tone: '调侃', length: 'short' };
const makePlan = (turns: unknown[]) => JSON.stringify({ skip: false, topic_keywords: ['减肥'], turns });

it.each([
  ['不在群的 speaker', [{ ...first, speaker: 'owner' }]],
  ['超过两个 turn', [first, first, first]],
  ['不存在的 reply_to', [{ ...first, reply_to: 'missing' }]],
  ['第一个 turn 向前引用', [{ ...first, reply_to: 'turn:0' }]],
])('拒绝导演输出：%s', async (_name, turns) => {
  const characters = await loadCharacters();
  expect(() => parseDirectorPlan(makePlan(turns), characters, [{ id: 'user_1', speaker: '群主', text: '你好' }], 'user_1')).toThrow();
});

it('按顺序生成，第二位能看到并回应第一位刚生成的台词', async () => {
  const call = vi.fn<typeof callLLM>()
    .mockResolvedValueOnce(result(makePlan([first, { ...first, speaker: 'zhu_bajie', reply_to: 'turn:0' }])))
    .mockResolvedValueOnce(result('{"text":"呆子先放下碗！"}'))
    .mockResolvedValueOnce(result('{"text":"空碗也不让拿？"}'));
  const output: string[] = [];
  const round = await runRound('明天减肥', { call, print: (text) => output.push(text), warn: vi.fn() });
  expect(call).toHaveBeenCalledTimes(3);
  expect(call.mock.calls[2][0][1].content).toContain('[turn:0] 孙悟空：呆子先放下碗！');
  expect(round.messages.at(-1)?.text).toBe('空碗也不让拿？');
  expect(output.join('\n')).toContain('猪八戒 → 回复[turn:0]：空碗也不让拿？');
});

it('导演两次不合法后随机一个角色回应群主；发言解析失败保留原文', async () => {
  const call = vi.fn<typeof callLLM>()
    .mockResolvedValueOnce(result('不是 JSON'))
    .mockResolvedValueOnce(result(makePlan([{ ...first, speaker: 'unknown' }])))
    .mockResolvedValueOnce(result('明天的饭，今日就惦记了？'));
  const round = await runRound('明天减肥', { call, print: vi.fn(), warn: vi.fn() });
  expect(call).toHaveBeenCalledTimes(3);
  expect(round.plan.turns).toHaveLength(1);
  expect(round.plan.turns[0].reply_to).toBe('user_1');
  expect(['sun_wukong', 'zhu_bajie', 'lin_daiyu']).toContain(round.plan.turns[0].speaker);
  expect(round.messages.at(-1)?.text).toBe('明天的饭，今日就惦记了？');
});

it('导演一次校验失败后可以恢复，不多调用发言人', async () => {
  const call = vi.fn<typeof callLLM>()
    .mockResolvedValueOnce(result('{}'))
    .mockResolvedValueOnce(result(makePlan([first])))
    .mockResolvedValueOnce(result('{"text":"俺老孙来！"}'));
  const round = await runRound('明天减肥', { call, print: vi.fn(), warn: vi.fn() });
  expect(call).toHaveBeenCalledTimes(3);
  expect(round.messages.at(-1)?.speaker).toBe('孙悟空');
});

it('skip 为 true 时不生成台词', async () => {
  const call = vi.fn<typeof callLLM>().mockResolvedValue(result('{"skip":true,"skip_reason":"暂不接话","topic_keywords":[],"turns":[]}'));
  await runRound('测试', { call, print: vi.fn(), warn: vi.fn() });
  expect(call).toHaveBeenCalledTimes(1);
});

it('模板替换不递归展开群主消息中的占位符', () => {
  expect(fillTemplate('{{message}}', { message: '{{secret}}', secret: 'hidden' })).toBe('{{secret}}');
});
