import { readFile } from 'node:fs/promises';

export function fillTemplate(template: string, variables: Record<string, string>): string {
  // 单次替换，避免消息内容中的 {{...}} 被再次当作变量。
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!Object.hasOwn(variables, name)) throw new Error(`提示词缺少变量：${name}`);
    return variables[name];
  });
}

export async function loadPrompts() {
  const [directorSystem, directorUser, speakerSystem, speakerUser] = await Promise.all(
    ['director-system', 'director-user', 'speaker-system', 'speaker-user'].map((name) =>
      readFile(new URL(`./${name}.txt`, import.meta.url), 'utf8'),
    ),
  );
  return { directorSystem, directorUser, speakerSystem, speakerUser };
}
