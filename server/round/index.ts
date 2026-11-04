import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadCharacters, type Character } from '../characters/index.js';
import { callLLM, LLMError, type ChatMessage, type ChatOptions } from '../llm/index.js';
import { directorSystem, directorUser, speakerSystem, speakerUser, fillTemplate } from '../prompts/index.js';
import { findMentions, enforceMentions } from './mentions.js';
import { cleanIntent, isOOC } from './ooc.js';
import type { DirectorPlan, Message, RoundInput, RoundOutput } from './types.js';
export type { RoundInput, RoundOutput } from './types.js';

const planShape = z.object({
  skip: z.boolean(), skipReason: z.string().optional(), topicKeywords: z.array(z.string()).max(3),
  turns: z.array(z.object({
    speaker: z.string(), replyTo: z.string(), intent: z.string().min(1).max(60),
    tone: z.enum(['调侃', '吐槽', '认真', '捧场', '生气', '傲娇', '感慨']), length: z.enum(['short', 'medium']),
  })).max(2),
});

export function parseDirectorPlan(text: string, members: Character[], messages: Message[], ownerId: string): DirectorPlan {
  return planShape.superRefine((plan, context) => {
    const invalid = (message: string) => context.addIssue({ code: 'custom', message });
    if (plan.skip && plan.turns.length) invalid('跳过时不得安排发言');
    if (!plan.skip && (!plan.turns.length || !plan.turns.some((turn) => turn.replyTo === ownerId))) invalid('必须直接回应群主');
    if (new Set(plan.turns.map((turn) => turn.speaker)).size !== plan.turns.length) invalid('发言人不得重复');
    for (const [index, turn] of plan.turns.entries()) {
      if (!members.some((member) => member.id === turn.speaker)) invalid('发言人不在群中');
      if (!messages.some((message) => message.id === turn.replyTo) && !(index === 1 && turn.replyTo === 'turn:0')) invalid('回复目标无效');
    }
  }).parse(JSON.parse(text));
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(new LLMError('ABORTED', '本轮时间预算已用尽。')); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    promise.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}

export async function runRound(input: RoundInput, deps?: { call?: typeof callLLM }): Promise<RoundOutput> {
  const started = performance.now();
  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), 45_000);
  const timings: RoundOutput['timings'] = { directorMs: 0, speakersMs: [], retryWaitMs: 0, totalMs: 0 };
  const warnings: string[] = [];
  const replies: Message[] = [];
  let plan: DirectorPlan = { skip: true, skipReason: '本轮未完成编排', topicKeywords: [], turns: [] };
  const call = deps?.call ?? callLLM;
  const callInBudget = async (messages: ChatMessage[], options: ChatOptions) => {
    const remaining = 45_000 - (performance.now() - started);
    if (remaining <= 0) { controller.abort(); throw new LLMError('ABORTED', '本轮时间预算已用尽。'); }
    return withAbort(call(messages, { ...options, timeoutMs: Math.min(15_000, remaining), signal: controller.signal,
      onRetry: (event) => { timings.retryWaitMs += event.waitMs; },
    }), controller.signal);
  };
  try {
    const all = loadCharacters();
    const members = all.filter((character) => input.group.memberIds.includes(character.id));
    if (!members.length) throw new LLMError('CLIENT_ERROR', '群内没有可用的角色。');
    const owner = input.ownerMessage;
    if (owner.senderType !== 'owner' || owner.groupId !== input.group.id || !owner.id) throw new LLMError('CLIENT_ERROR', '群主消息与群信息不匹配。');
    const history = input.history.filter((message) => message.groupId === input.group.id && message.id !== owner.id).slice(-20);
    const context: Message[] = [...history, owner];
    const nameOf = (message: Message) => message.senderType === 'owner' ? input.group.ownerNickname : all.find((character) => character.id === message.senderId)?.name ?? '群消息';
    const format = () => context.map((message) => `[${message.id}] ${nameOf(message)}：${message.text}`).join('\n');
    const mentions = findMentions(owner.text, members, all);
    const relevant = new Set([...mentions.mentionedIds, ...history.slice(-5).filter((m) => m.senderType === 'character').map((m) => m.senderId)]);
    const relationsFor = (character: Character, targets: Set<string>) => character.relations.filter((relation) => targets.has(relation.target)).map((relation) =>
      `${character.name}→${all.find((item) => item.id === relation.target)?.name}：${relation.label}，称“${relation.nickname}”，${relation.dynamic}`,
    ).join('；') || '初次接话，依自己的性格交流';
    const directorMessages: ChatMessage[] = [
      { role: 'system', content: directorSystem },
      { role: 'user', content: fillTemplate(directorUser, {
        group_name: input.group.name, owner_nickname: input.group.ownerNickname, trigger_message_id: owner.id,
        characters: members.map((character) => `${character.id}｜${character.name}｜${character.tagline}`).join('\n'),
        relations: members.filter((character) => relevant.has(character.id)).map((character) => relationsFor(character, relevant)).join('\n') || '无本轮特定关系',
        mandatory: mentions.mentionedIds.map((id) => `${members.find((character) => character.id === id)!.name}(${id})`).join('、') || '无',
        exclusive: mentions.onlyId ? `【仅此一人】${mentions.onlyId}，其他人本轮不发言。` : '', recent_messages: format(),
      }) },
    ];
    let parsed: DirectorPlan | undefined;
    const directorStarted = performance.now();
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await callInBudget(directorMessages, { temperature: 0.7, jsonMode: true, maxTokens: 250 });
        try { parsed = parseDirectorPlan(result.text, members, context, owner.id); break; }
        catch {
          warnings.push(`导演编排结构校验失败（${attempt + 1}/2）。`);
          directorMessages.push({ role: 'user', content: '重新给出紧凑JSON。角色必须在群，最多两人，至少一条直接回群主，第一条不可向前引用。topicKeywords最多3个。' });
        }
      }
    } finally { timings.directorMs = Math.round(performance.now() - directorStarted); }
    if (!parsed) {
      parsed = { skip: false, topicKeywords: [], turns: [{ speaker: members[randomInt(members.length)].id, replyTo: owner.id, intent: '用自己的经历直接回应群主', tone: '调侃', length: 'short' }] };
      warnings.push('导演连续两次校验失败，降级为一个角色直接回应群主。');
    }
    plan = enforceMentions(parsed, mentions, owner.id, warnings);
    for (const turn of plan.turns) {
      if (isOOC(turn.intent)) { turn.intent = cleanIntent(turn.intent); warnings.push('已在本地清洗导演意图中的出戏措辞。'); }
    }
    for (const turn of plan.turns) {
      if (plan.skip) break;
      const character = members.find((item) => item.id === turn.speaker)!;
      let reply = owner;
      if (turn.replyTo === 'turn:0' && replies[0]) reply = replies[0];
      else if (turn.replyTo !== owner.id) {
        warnings.push('回复目标不可用或不在本轮回复链中，已改为直接回应群主。');
        turn.replyTo = owner.id;
      }
      const speakerMessages: ChatMessage[] = [
        { role: 'system', content: fillTemplate(speakerSystem, {
          name: character.name, world: character.world, group_name: input.group.name, identity: character.identity,
          style: character.voice.style, self_reference: character.voice.self_reference, address_owner: character.voice.address_owner,
          catchphrases: character.voice.catchphrases.join('、'), values: character.values.join('；'), triggers: character.triggers.join('；'),
          knowledge_boundary: character.knowledge_boundary, relations: relationsFor(character, new Set(plan.turns.map((item) => item.speaker))),
          examples: character.examples.join('\n'), humor_hooks: character.humor_hooks.join('；'), length_rule: turn.length === 'short' ? '不超过40字' : '不超过80字',
        }) },
        { role: 'user', content: fillTemplate(speakerUser, {
          recent_messages: format(), reply_to_id: reply.id, reply_to_speaker: nameOf(reply), reply_to_text: reply.text, intent: turn.intent, tone: turn.tone,
        }) },
      ];
      const speakerStarted = performance.now();
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const result = await callInBudget(speakerMessages, { temperature: 0.95, jsonMode: true, maxTokens: turn.length === 'short' ? 80 : 150 });
          let text = result.text;
          try {
            const parsedText = JSON.parse(text);
            if (typeof parsedText?.text === 'string' && parsedText.text.trim()) text = parsedText.text;
            else warnings.push('发言缺少有效正文，保留原文以便本地验证。');
          } catch { warnings.push('发言未返回有效JSON，保留原文以便本地验证。'); }
          if (isOOC(text)) {
            warnings.push(attempt === 0 ? `${character.name}的台词出戏，重新生成一次。` : `${character.name}的台词仍出戏，已丢弃。`);
            speakerMessages.push({ role: 'user', content: '请只以本人身份直接说一句群聊台词，不解释创作过程。仍只输出JSON。' });
            continue;
          }
          const message: Message = { id: randomUUID(), groupId: input.group.id, senderType: 'character', senderId: character.id, text,
            replyTo: reply.id, createdAt: new Date().toISOString(), deliverAt: '' };
          replies.push(message); context.push(message);
          break;
        }
      } finally { timings.speakersMs.push(Math.round(performance.now() - speakerStarted)); }
    }
  } catch (error) {
    if (!(error instanceof LLMError) || replies.length === 0) throw error;
    warnings.push(controller.signal.aborted
      ? '整轮达到45秒预算，已停止后续请求并返回已生成的部分。'
      : `后续角色发言暂时失败（${error.code}），已保留本轮生成的回复。`);
  } finally { clearTimeout(budgetTimer); timings.totalMs = Math.round(performance.now() - started); }
  let deliverAt = Date.now() + 1200;
  for (const reply of replies) {
    reply.deliverAt = new Date(deliverAt).toISOString();
    deliverAt += Math.max(1000, Math.min(3000, Array.from(reply.text).length * 80));
  }
  return { plan, replies, timings, warnings };
}
