import type { Message, DirectorPlan, DirectorTurn, Group } from '../../lib/types.js';

export type { Message, DirectorPlan, DirectorTurn };
export type RoundInput = {
  group: Pick<Group, 'id' | 'name' | 'ownerNickname' | 'memberIds'>;
  history: Message[];
  ownerMessage: Message;
};
export type RoundOutput = {
  plan: DirectorPlan;
  replies: Message[];
  timings: { directorMs: number; speakersMs: number[]; retryWaitMs: number; totalMs: number };
  warnings: string[];
};
