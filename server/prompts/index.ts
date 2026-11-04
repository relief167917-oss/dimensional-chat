export { directorSystem, directorUser } from './director.js';
export { speakerSystem, speakerUser } from './speaker.js';

export function fillTemplate(template: string, variables: Record<string, string>): string {
  // 单次替换，避免消息内容中的 {{...}} 被再次当作变量。
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!Object.hasOwn(variables, name)) throw new Error(`提示词缺少变量：${name}`);
    return variables[name];
  });
}
