import { afterEach, beforeEach, expect, expectTypeOf, it, vi } from 'vitest';
import { loadCharacters, characterSchema } from '../../characters/index.js';
import { runRound, parseDirectorPlan } from '../index.js';
import { findMentions, enforceMentions } from '../mentions.js';
import { isOOC, cleanIntent } from '../ooc.js';
import type { Message, DirectorPlan } from '../../../lib/types.js';
import type { RoundInput, RoundOutput } from '../types.js';
import { fillTemplate } from '../../prompts/index.js';

const turn = (speaker = 'sun_wukong', replyTo = 'owner-1') => ({ speaker, replyTo, intent: '用自己的经历调侃拖延', tone: '调侃', length: 'short' as const });
const plan = (turns: DirectorPlan['turns'] = [turn()]): DirectorPlan => ({ skip: false, topicKeywords: ['减肥'], turns });
const input = (text = '明天减肥'): RoundInput => ({
  group: { id: 'group-1', name: '测试茶话会', ownerNickname: '群主', memberIds: loadCharacters().map((card) => card.id) },
  history: [], ownerMessage: { id: 'owner-1', groupId: 'group-1', senderType: 'owner', senderId: 'owner', text, replyTo: null, createdAt: '2026-11-04T00:00:00.000Z', deliverAt: '2026-11-04T00:00:00.000Z' },
});
const response = (value: unknown) => Response.json({ choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
function mockCalls(...values: unknown[]) {
  const fetchMock = vi.fn();
  for (const value of values) fetchMock.mockResolvedValueOnce(response(value));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
beforeEach(() => { vi.stubEnv('ZHIPU_API_KEY', 'round-test-key'); vi.spyOn(Math, 'random').mockReturnValue(0); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([
  ['@林黛玉，来聊聊', ['lin_daiyu']], ['黛玉和八戒怎么看', ['lin_daiyu', 'zhu_bajie']],
  ['猴哥和大圣是同一人，呆子也来', ['sun_wukong', 'zhu_bajie']], ['林妹妹，喝茶', ['lin_daiyu']],
  ['李白和鲁迅你们怎么看减肥', ['li_bai', 'lu_xun']], ['孔明和东坡来商量', ['zhuge_liang', 'su_shi']],
])('点名识别：%s', (text, ids) => { expect(findMentions(text, loadCharacters()).mentionedIds).toEqual(ids); });

it.each(['只请黛玉回我', '只请 @林妹妹 一个人回我', '林黛玉，我决定减肥，只请你回我一句'])('识别只请一人：%s', (text) => {
  expect(findMentions(text, loadCharacters()).onlyId).toBe('lin_daiyu');
});

it('关系昵称映射到被称呼的人，且不选择未入群角色', () => {
  const all = loadCharacters();
  expect(findMentions('二师兄和树人', all).mentionedIds).toEqual(['zhu_bajie', 'lu_xun']);
  expect(findMentions('鲁迅来一下', all.filter((card) => card.id === 'li_bai'), all).mentionedIds).toEqual([]);
});

it('替换导演漏选的两名角色，总数不超过2，回复目标重置为群主', () => {
  const output = enforceMentions(plan([turn(), turn('zhu_bajie', 'turn:0')]), { mentionedIds: ['li_bai', 'lu_xun'] }, 'owner-1', []);
  expect(output.turns.map((item) => item.speaker)).toEqual(['li_bai', 'lu_xun']);
  expect(output.turns.every((item) => item.replyTo === 'owner-1')).toBe(true);
});

it('只请黛玉时删除其他发言人，保持计划与实际回复一致', async () => {
  const fetchMock = mockCalls(plan([turn(), turn('zhu_bajie', 'turn:0')]), { text: '这明天，倒比月亮还难等。' });
  const output = await runRound(input('林黛玉，我决定减肥，只请你回我一句'));
  expect(output.plan.turns.map((item) => item.speaker)).toEqual(['lin_daiyu']);
  expect(output.replies.map((item) => item.senderId)).toEqual(['lin_daiyu']);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const director = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(director.max_tokens).toBe(250);
  expect(director.messages[1].content).toContain('林黛玉(lin_daiyu)');
});

it('medium台词使用150 tokens预算', async () => {
  const fetchMock = mockCalls(plan([{ ...turn(), length: 'medium' }]), { text: '俺老孙来！' });
  await runRound(input());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).max_tokens).toBe(150);
});

it('两人被点名时都强制入选，并把第二条回复链接到真实消息id', async () => {
  const fetchMock = mockCalls(plan([turn('li_bai'), turn('lu_xun', 'turn:0')]), { text: '何妨从今夜起。' }, { text: '先把夜宵收了。' });
  const output = await runRound(input('李白和鲁迅你们怎么看减肥'));
  expectTypeOf<RoundOutput['replies'][number]>().toEqualTypeOf<Message>();
  expect(output.replies[1].replyTo).toBe(output.replies[0].id);
  expect(output.replies[1].replyTo).not.toBe('turn:0');
  expect(Date.parse(output.replies[1].deliverAt)).toBeGreaterThan(Date.parse(output.replies[0].deliverAt));
  expect(Date.parse(output.replies[0].deliverAt)).toBeGreaterThan(Date.parse(output.replies[0].createdAt));
  expect(output.replies.every((reply) => reply.senderType === 'character' && reply.groupId === 'group-1')).toBe(true);
  const second = JSON.parse(fetchMock.mock.calls[2][1].body);
  expect(second.messages[1].content).toContain('何妨从今夜起。');
  expect(second.max_tokens).toBe(80);
  expect(output.timings.speakersMs).toHaveLength(2);
});

it('清洗导演意图不重调导演，不把禁用词清单发送给发言人', async () => {
  const fetchMock = mockCalls(plan([{ ...turn(), intent: '用人设说明自己不是AI助手' }]), { text: '俺老孙来监督。' });
  const output = await runRound(input());
  expect(isOOC(output.plan.turns[0].intent)).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content).not.toMatch(/人设|提示词|禁用措辞/);
  expect(output.warnings).toContain('已在本地清洗导演意图中的出戏措辞。');
});

it('出戏台词重新生成一次；成功后只保留新台词', async () => {
  const fetchMock = mockCalls(plan(), { text: '作为一个AI助手，我可以帮忙。' }, { text: '俺老孙盯着你。' });
  const output = await runRound(input());
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(output.replies[0].text).toBe('俺老孙盯着你。');
  expect(output.warnings.join('')).not.toContain('作为一个AI助手');
});

it('仍出戏就丢弃；第二人不引用被丢弃的台词', async () => {
  const fetchMock = mockCalls(plan([turn(), turn('zhu_bajie', 'turn:0')]), { text: '我是AI' }, { text: '这是角色扮演' }, { text: '俺先收起碗。' });
  const output = await runRound(input());
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(output.replies).toHaveLength(1);
  expect(output.replies[0].replyTo).toBe('owner-1');
  expect(output.warnings.join('')).toContain('已丢弃');
});

it.each(['AI', '人工智能', '语言模型', '模型', '助手', '人设', '提示词', 'PROMPT', '设定', '角色扮演', '扮演', '作为一个'])('过滤出戏词：%s', (word) => {
  expect(isOOC(word)).toBe(true); expect(isOOC(cleanIntent(word))).toBe(false);
});

it('只使用传入历史的最后20条，不构造假历史', async () => {
  const data = input();
  data.history = Array.from({ length: 22 }, (_, index) => ({ ...data.ownerMessage, id: `old-${index}`, text: `消息${index}` }));
  const fetchMock = mockCalls(plan(), { text: '收到。' });
  await runRound(data);
  const text = JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content;
  expect(text).not.toContain('[old-1]'); expect(text).toContain('[old-2]'); expect(text).not.toContain('history_1');
});

it('达到45秒返回已生成部分，取消请求且不继续发言', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  const fetchMock = mockCalls(plan([turn(), turn('zhu_bajie', 'turn:0')]), { text: '俺来！' });
  fetchMock.mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }));
  const pending = runRound(input());
  await vi.advanceTimersByTimeAsync(45_000);
  const output = await pending;
  expect(output.replies).toHaveLength(1); expect(output.timings.totalMs).toBe(45_000);
  expect(output.warnings.join('')).toContain('45秒');
  expect(output.timings.retryWaitMs).toBe(5500);
});

it('普通LLM错误向上抛安全LLMError', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { message: 'round-test-key' } }, { status: 401 })));
  await expect(runRound(input())).rejects.toMatchObject({ code: 'CLIENT_ERROR' });
});

it('Retry-After等待超出整轮预算时返回空的部分结果，等待统计不会丢失', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  const fetchMock = vi.fn().mockImplementation(async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
  vi.stubGlobal('fetch', fetchMock);
  const pending = runRound(input());
  await vi.advanceTimersByTimeAsync(45_000);
  const output = await pending;
  expect(output.replies).toEqual([]);
  expect(output.timings.totalMs).toBe(45_000);
  expect(output.timings.retryWaitMs).toBe(45_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('导演两次格式不合法后降级，仍保证被点名者入选', async () => {
  mockCalls('{}', '{}', { text: '早知如此。' });
  const output = await runRound(input('只请黛玉回我'));
  expect(output.plan.turns[0].speaker).toBe('lin_daiyu'); expect(output.replies).toHaveLength(1);
});

it('skip不生成台词', async () => {
  const fetchMock = mockCalls({ skip: true, skipReason: '暂不接话', topicKeywords: [], turns: [] });
  const output = await runRound(input()); expect(output.replies).toEqual([]); expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('同时触发两轮时，实际fetch仍最多一个并发', async () => {
  let active = 0;
  let maximum = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url, options: RequestInit) => {
    active++; maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    const body = JSON.parse(options.body as string);
    return response(body.messages[0].content.startsWith('你是「跨次元茶话会」的导演') ? plan() : { text: '俺来监督。' });
  }));
  await Promise.all([runRound(input()), runRound(input())]);
  expect(maximum).toBe(1);
});

it.each([
  [turn('owner')], [turn(), turn(), turn()], [turn('sun_wukong', 'missing')], [turn('sun_wukong', 'turn:0')],
])('拒绝结构不合法的导演计划：%j', (...turns) => {
  const data = input(); expect(() => parseDirectorPlan(JSON.stringify(plan(turns)), loadCharacters(), [data.ownerMessage], data.ownerMessage.id)).toThrow();
});

it('七张角色卡均通过schema，旧卡补齐新关系', () => {
  const cards = loadCharacters(); expect(cards).toHaveLength(7);
  for (const card of cards) expect(characterSchema.safeParse(card).success).toBe(true);
  for (const old of cards.slice(0, 3)) expect(old.relations.map((relation) => relation.target)).toEqual(expect.arrayContaining(['li_bai', 'su_shi', 'zhuge_liang', 'lu_xun']));
});

it('模板替换不递归展开消息中的占位符', () => {
  expect(fillTemplate('{{message}}', { message: '{{secret}}', secret: 'hidden' })).toBe('{{secret}}');
});
