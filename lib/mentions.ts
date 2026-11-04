import type { CharacterCard } from "@/lib/types";

/** 按姓名长度降序，避免短名抢先匹配长名 */
export function mentionNames(characters: CharacterCard[]): string[] {
  const names = new Set<string>();
  for (const c of characters) {
    names.add(c.name);
    for (const a of c.aliases) names.add(a);
  }
  return [...names].sort((a, b) => b.length - a.length);
}

export function filterCharacters(
  characters: CharacterCard[],
  query: string,
): CharacterCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return characters;
  return characters.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.aliases.some((a) => a.toLowerCase().includes(q)),
  );
}

export type TextPart =
  | { type: "text"; value: string }
  | { type: "mention"; value: string };

/** 把文本拆成普通片段与 @提及 */
export function splitMentions(
  text: string,
  characters: CharacterCard[],
): TextPart[] {
  const names = mentionNames(characters);
  if (names.length === 0 || !text.includes("@")) {
    return [{ type: "text", value: text }];
  }

  const escaped = names.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const re = new RegExp(`@(${escaped.join("|")})`, "g");
  const parts: TextPart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    parts.push({ type: "mention", value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}
