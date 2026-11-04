import sun_wukong from './sun_wukong.json' with { type: 'json' };
import zhu_bajie from './zhu_bajie.json' with { type: 'json' };
import lin_daiyu from './lin_daiyu.json' with { type: 'json' };
import li_bai from './li_bai.json' with { type: 'json' };
import su_shi from './su_shi.json' with { type: 'json' };
import zhuge_liang from './zhuge_liang.json' with { type: 'json' };
import lu_xun from './lu_xun.json' with { type: 'json' };
import { z } from 'zod';

export const characterSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), aliases: z.array(z.string()).default([]), world: z.string(), tagline: z.string(),
  identity: z.string(),
  voice: z.object({
    style: z.string(), self_reference: z.string(), address_owner: z.string(),
    catchphrases: z.array(z.string()), forbidden_words: z.array(z.string()),
  }),
  values: z.array(z.string()), triggers: z.array(z.string()), knowledge_boundary: z.string(),
  humor_hooks: z.array(z.string()).length(4),
  relations: z.array(z.object({ target: z.string(), label: z.string(), dynamic: z.string(), nickname: z.string() })),
  examples: z.array(z.string()).min(2).max(3),
});

export type Character = z.infer<typeof characterSchema>;

const cards: Character[] = [sun_wukong, zhu_bajie, lin_daiyu, li_bai, su_shi, zhuge_liang, lu_xun].map((card) => characterSchema.parse(card));
export function loadCharacters(): Character[] { return structuredClone(cards); }
