const words = ['人工智能', '语言模型', '角色扮演', '作为一个', '提示词', '模型', '助手', '人设', '设定', '扮演'];
const pattern = () => new RegExp(`${words.join('|')}|\\b(?:AI|prompt)\\b`, 'giu');

export function isOOC(text: string): boolean {
  return pattern().test(text.normalize('NFKC'));
}

export function cleanIntent(intent: string): string {
  return intent.normalize('NFKC').replace(pattern(), '').replace(/\s+/g, ' ').trim() || '用自己的经历直接回应群主';
}
