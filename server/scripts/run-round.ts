import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { LLMError } from '../llm/index.js';
import { runRound } from './round.js';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

class ArgumentError extends Error {}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('用法：pnpm round ["群主的一句话"] [--times N]\n默认：我决定从明天开始减肥，谁来监督我？\n每一轮使用相同的四条假历史消息，所有调用串行执行。');
    return;
  }
  let times = 1;
  let sawTimes = false;
  const words: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--times' || arg.startsWith('--times=')) {
      if (sawTimes) throw new ArgumentError('--times 只能指定一次。');
      sawTimes = true;
      const value = arg === '--times' ? args[++index] : arg.slice('--times='.length);
      if (!value || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new ArgumentError('--times 必须是正整数，例如 --times 3。');
      }
      times = Number(value);
    } else if (arg.startsWith('--')) {
      throw new ArgumentError('存在未知选项，请使用 pnpm round --help 查看用法。');
    } else {
      words.push(arg);
    }
  }
  if (!process.env.ZHIPU_API_KEY?.trim()) {
    throw new LLMError('MISSING_API_KEY', '缺少 ZHIPU_API_KEY，请设置环境变量或填写 server/.env。');
  }
  const message = words.join(' ').trim() || '我决定从明天开始减肥，谁来监督我？';
  for (let index = 0; index < times; index++) {
    console.log(`\n=== 第 ${index + 1}/${times} 轮 ===`);
    await runRound(message);
  }
}

main().catch((error: unknown) => {
  // 不向终端传递原始异常、堆栈或响应体。
  if (error instanceof LLMError) console.error(`错误[${error.code}]：${error.message}`);
  else if (error instanceof ArgumentError) console.error(`参数错误：${error.message}`);
  else console.error('运行失败：请检查 server/ 下的角色卡、提示词文件和依赖是否完整。');
  process.exitCode = 1;
});
