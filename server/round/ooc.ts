const words = ['人工智能', '语言模型', 'AI模型', 'AI助手', '角色扮演', '我在扮演', '人设', '设定上', '提示词'];
const pattern = () => new RegExp(`${words.join('|')}|\\b(?:AI|prompt)\\b`, 'giu');

export function isOOC(text: string): boolean {
  return pattern().test(text.normalize('NFKC'));
}

export function cleanIntent(intent: string): string {
  return intent.normalize('NFKC').replace(pattern(), '').replace(/\s+/g, ' ').trim() || '用自己的经历直接回应群主';
}
