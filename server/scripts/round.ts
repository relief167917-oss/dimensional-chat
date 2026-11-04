import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { loadCharacters, type Character } from '../characters/index.js';
import { callLLM, LLMError } from '../llm/index.js';
import { fillTemplate, loadPrompts } from '../prompts/index.js';

interface GroupMessage {
  id: string;
  speaker: string;
  text: string;
}

const planShape = z.object({
  skip: z.boolean(),
  skip_reason: z.string().optional(),
  topic_keywords: z.array(z.string()).max(5),
  turns: z.array(z.object({
    speaker: z.string(),
    reply_to: z.string(),
    intent: z.string().min(1).max(60),
    tone: z.enum(['调侃', '吐槽', '认真', '捧场', '生气', '傲娇', '感慨']),
    length: z.enum(['short', 'medium']),
  })).max(2),
});

export type DirectorPlan = z.infer<typeof planShape>;

export function parseDirectorPlan(text: string, characters: Character[], messages: GroupMessage[], triggerId: string) {
  const characterIds = new Set(characters.map((character) => character.id));
  const messageIds = new Set(messages.map((message) => message.id));
  return planShape.superRefine((plan, context) => {
    const invalid = (message: string) => context.addIssue({ code: 'custom', message });
    if (plan.skip && plan.turns.length !== 0) invalid('跳过时不得安排发言');
    if (!plan.skip && (plan.turns.length === 0 || !plan.turns.some((turn) => turn.reply_to === triggerId))) {
      invalid('必须至少有一个角色直接回应群主');
    }
    plan.turns.forEach((turn, index) => {
      if (!characterIds.has(turn.speaker)) invalid('speaker 必须是在群角色');
      if (!messageIds.has(turn.reply_to) && !(index > 0 && turn.reply_to === 'turn:0')) {
        invalid('reply_to 必须是已有消息，且不得向前引用');
      }
    });
  }).parse(JSON.parse(text));
}

function formatMessages(messages: GroupMessage[]) {
  return messages.map((message) => `[${message.id}] ${message.speaker}：${message.text}`).join('\n');
}

function formatRelations(character: Character, characters: Character[]) {
  return character.relations.map((relation) => {
    const name = characters.find((other) => other.id === relation.target)?.name ?? relation.target;
    return `${name}（${relation.label}，称呼“${relation.nickname}”）：${relation.dynamic}`;
  }).join('；');
}

export async function runRound(
  ownerText: string,
  { call = callLLM, print = console.log, warn = console.error }: {
    call?: typeof callLLM;
    print?: (text: string) => void;
    warn?: (text: string) => void;
  } = {},
) {
  const started = performance.now();
  try {
    const [characters, prompts] = await Promise.all([loadCharacters(), loadPrompts()]);
    const messages: GroupMessage[] = [
      { id: 'history_1', speaker: '群主', text: '茶话会开张，大家先说说一路上最惦记什么。' },
      { id: 'history_2', speaker: '猪八戒', text: '赶了半天路，俺老猪先问一句：茶点在哪儿？' },
      { id: 'history_3', speaker: '孙悟空', text: '呆子，坐下还没一盏茶，又惦记吃的。' },
      { id: 'history_4', speaker: '林黛玉', text: '二师兄这份惦记，倒是从不落空。' },
      { id: 'user_1', speaker: '群主', text: ownerText },
    ];
    const trigger = messages[messages.length - 1];
    const directorMessages = [
      { role: 'system' as const, content: prompts.directorSystem },
      { role: 'user' as const, content: fillTemplate(prompts.directorUser, {
        group_name: '跨次元茶话会', owner_nickname: '群主', trigger_message_id: trigger.id,
        characters: characters.map((character) =>
          `- id=${character.id}｜${character.name}｜${character.tagline}｜关系：${formatRelations(character, characters)}`,
        ).join('\n'),
        recent_messages: formatMessages(messages),
      }) },
    ];

    const measuredCall = async (label: string, ...args: Parameters<typeof callLLM>) => {
      const callStarted = performance.now();
      try {
        const result = await call(...args);
        const usage = result.usage;
        print(`[${label}] provider=${result.provider} 耗时=${result.latencyMs}ms tokens=${usage
          ? `输入:${usage.promptTokens} 输出:${usage.completionTokens} 总计:${usage.totalTokens}`
          : '未知（服务商未返回用量）'}`);
        return result;
      } catch (error) {
        print(`[${label}] 调用失败 耗时=${Math.round(performance.now() - callStarted)}ms tokens=未知 code=${error instanceof LLMError ? error.code : 'UNKNOWN'}`);
        throw error;
      }
    };

    let plan: DirectorPlan | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await measuredCall(`导演${attempt ? '校验重试' : ''}`, directorMessages, {
        temperature: 0.7, jsonMode: true, maxTokens: 600,
      });
      try {
        plan = parseDirectorPlan(result.text, characters, messages, trigger.id);
        break;
      } catch {
        warn(`导演 JSON 校验失败（${attempt + 1}/2）。`);
        if (attempt === 0) {
          directorMessages.push({ role: 'user', content: '上一轮输出未通过校验。请重新输出完整 JSON；speaker 只能来自在群角色，turns 最多 2 条，reply_to 必须是已知消息 id，只有第二条可以引用 turn:0。非 skip 时至少一条直接回应触发消息，intent 不超过 60 字。' });
        }
      }
    }
    if (!plan) {
      const character = characters[randomInt(characters.length)];
      plan = {
        skip: false, topic_keywords: [],
        turns: [{ speaker: character.id, reply_to: trigger.id, intent: '用自己的经历和口吻，简短而有趣地直接回应群主', tone: '调侃', length: 'short' }],
      };
      warn('导演连续两次校验失败，降级为随机一个角色直接回应群主。');
    }
    print(`导演 JSON：\n${JSON.stringify(plan, null, 2)}`);
    if (plan.skip) {
      print(`本轮跳过：${plan.skip_reason || '导演决定暂不接话'}`);
      return { plan, messages };
    }

    // 每次都 await，第二位发言前，第一位台词已加入上下文。
    for (const [index, turn] of plan.turns.entries()) {
      const character = characters.find((item) => item.id === turn.speaker)!;
      const reply = messages.find((message) => message.id === turn.reply_to)!;
      const result = await measuredCall(`发言:${character.name}`, [
        { role: 'system', content: fillTemplate(prompts.speakerSystem, {
          name: character.name, world: character.world, group_name: '跨次元茶话会',
          identity: character.identity, style: character.voice.style,
          self_reference: character.voice.self_reference, address_owner: character.voice.address_owner,
          catchphrases: character.voice.catchphrases.join('、'), values: character.values.join('；'),
          triggers: character.triggers.join('；'), knowledge_boundary: character.knowledge_boundary,
          relations: formatRelations(character, characters), examples: character.examples.join('\n\n'),
          humor_hooks: character.humor_hooks.join('；'), forbidden_words: character.voice.forbidden_words.join('、'),
          length_rule: turn.length === 'short' ? '不超过 40 字' : '不超过 80 字',
        }) },
        { role: 'user', content: fillTemplate(prompts.speakerUser, {
          recent_messages: formatMessages(messages), reply_to_id: reply.id,
          reply_to_speaker: reply.speaker, reply_to_text: reply.text, intent: turn.intent, tone: turn.tone,
        }) },
      ], { temperature: 0.95, jsonMode: true, maxTokens: 200 });
      let text = result.text;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.text === 'string' && parsed.text.trim()) text = parsed.text;
        else warn(`${character.name}的发言 JSON 缺少有效 text，直接使用原文。`);
      } catch {
        warn(`${character.name}的发言 JSON 解析失败，直接使用原文。`);
      }
      print(`${character.name} → 回复[${reply.id}]：${text}`);
      messages.push({ id: `turn:${index}`, speaker: character.name, text });
    }
    return { plan, messages };
  } finally {
    print(`本轮总耗时：${Math.round(performance.now() - started)}ms`);
  }
}
