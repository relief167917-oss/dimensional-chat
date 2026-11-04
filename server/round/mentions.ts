import type { Character } from '../characters/index.js';
import type { DirectorPlan, DirectorTurn } from './types.js';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export type Mentions = { mentionedIds: string[]; onlyId?: string };

export function findMentions(text: string, members: Character[], allCharacters: Character[] = members): Mentions {
  const found: { id: string; position: number }[] = [];
  let onlyId: string | undefined;
  for (const character of members) {
    const names = new Set([character.name, character.id, ...character.aliases]);
    for (const other of allCharacters) {
      for (const relation of other.relations) if (relation.target === character.id) names.add(relation.nickname);
    }
    let position = Infinity;
    for (const name of [...names].filter(Boolean).sort((a, b) => b.length - a.length)) {
      const at = text.indexOf(name);
      if (at >= 0) position = Math.min(position, at);
      const exclusive = new RegExp(`(?:只(?:请|让|要|叫)?|仅(?:请|让|要)?|就请)\\s*@?\\s*${escape(name)}(?:\\s|[，,])*?(?:一(?:个)?人)?(?:来|给我|回我|回复|说|发言|回答|讲|聊|开口)`);
      if (exclusive.test(text)) onlyId = character.id;
    }
    if (Number.isFinite(position)) found.push({ id: character.id, position });
  }
  const mentionedIds = found.sort((a, b) => a.position - b.position).map((item) => item.id);
  if (!onlyId && mentionedIds.length === 1 && /只(?:请|让|要|叫)?\s*(?:你|您)(?:一(?:个)?人)?\s*(?:来|给我|回我|回复|说|发言|回答|讲|聊|开口)/.test(text)) onlyId = mentionedIds[0];
  return { mentionedIds, ...(onlyId ? { onlyId } : {}) };
}

export function enforceMentions(plan: DirectorPlan, mentions: Mentions, ownerId: string, warnings: string[]): DirectorPlan {
  if (plan.skip) return { ...plan, turns: [] };
  const makeTurn = (speaker: string): DirectorTurn => ({ speaker, replyTo: ownerId, intent: '用自己的经历和口吻直接回应群主', tone: '调侃', length: 'short' });
  if (mentions.onlyId) {
    const existing = plan.turns.find((turn) => turn.speaker === mentions.onlyId);
    if (plan.turns.length !== 1 || !existing || existing.replyTo !== ownerId) warnings.push('已按“只请一人”的要求修正导演安排。');
    return { ...plan, turns: [{ ...(existing ?? makeTurn(mentions.onlyId)), replyTo: ownerId }] };
  }
  const required = mentions.mentionedIds.slice(0, 2);
  if (mentions.mentionedIds.length > 2) warnings.push('点名超过两位，本轮按提及顺序保留前两位。');
  const turns = plan.turns.map((turn) => ({ ...turn }));
  for (const id of required) {
    if (turns.some((turn) => turn.speaker === id)) continue;
    const replace = turns.findIndex((turn) => !required.includes(turn.speaker));
    if (replace >= 0) turns[replace] = makeTurn(id);
    else if (turns.length < 2) turns.unshift(makeTurn(id));
    warnings.push('导演漏选点名角色，已强制修正。');
  }
  if (turns[0]?.replyTo === 'turn:0') turns[0].replyTo = ownerId;
  if (!turns.some((turn) => turn.replyTo === ownerId) && turns[0]) turns[0].replyTo = ownerId;
  return { ...plan, turns };
}
