import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const characterSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), world: z.string(), tagline: z.string(),
  identity: z.string(),
  voice: z.object({
    style: z.string(), self_reference: z.string(), address_owner: z.string(),
    catchphrases: z.array(z.string()), forbidden_words: z.array(z.string()),
  }),
  values: z.array(z.string()), triggers: z.array(z.string()), knowledge_boundary: z.string(),
  humor_hooks: z.array(z.string()),
  relations: z.array(z.object({ target: z.string(), label: z.string(), dynamic: z.string(), nickname: z.string() })),
  examples: z.array(z.string()).min(1).max(2),
});

export type Character = z.infer<typeof characterSchema>;

export async function loadCharacters(): Promise<Character[]> {
  return Promise.all(['sun_wukong', 'zhu_bajie', 'lin_daiyu'].map(async (id) => {
    const text = await readFile(new URL(`./${id}.json`, import.meta.url), 'utf8');
    return characterSchema.parse(JSON.parse(text));
  }));
}
