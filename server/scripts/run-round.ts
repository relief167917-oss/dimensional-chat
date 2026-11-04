import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadCharacters } from '../characters/index.js';
import { callLLM, LLMError } from '../llm/index.js';
import { runRound } from '../round/index.js';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

class ArgumentError extends Error {}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('用法：pnpm round ["群主的一句话"] [--times N]\n默认：我决定从明天开始减肥，谁来监督我？\n每轮使用空历史，所有模型调用串行执行，整轮预算45秒。');
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
    const roundStarted = performance.now();
    try {
      const now = new Date().toISOString();
      const characters = loadCharacters();
      const output = await runRound({
        group: { id: 'cli-demo', name: '跨次元茶话会', ownerNickname: '群主', memberIds: characters.map((item) => item.id) },
        history: [],
        ownerMessage: { id: randomUUID(), groupId: 'cli-demo', senderType: 'owner', senderId: 'owner', text: message, replyTo: null, createdAt: now, deliverAt: now },
      }, { call: async (messages, options = {}) => {
        const label = messages[0].content.startsWith('你就是') ? `speaker:${messages[0].content.split('，')[0].slice(3)}` : 'director';
        const callStarted = performance.now();
        let result;
        try { result = await callLLM(messages, { ...options, onRetry: (event) => {
          console.log(`[retry] ${label} 第${event.attempt}次退避 ${event.waitMs}ms code=${event.code}`);
          options.onRetry?.(event);
        } }); } catch (error) {
          console.log(`[${label}] 调用失败 耗时=${Math.round(performance.now() - callStarted)}ms tokens=未知 code=${error instanceof LLMError ? error.code : 'UNKNOWN'}`);
          throw error;
        }
        const usage = result.usage;
        console.log(`[${label}] provider=${result.provider} 耗时=${result.latencyMs}ms tokens=${usage ? `输入:${usage.promptTokens} 输出:${usage.completionTokens} 总计:${usage.totalTokens}` : '未知'}`);
        return result;
      } });
      console.log(`导演 JSON：\n${JSON.stringify(output.plan, null, 2)}`);
      for (const reply of output.replies) {
        console.log(`${characters.find((item) => item.id === reply.senderId)!.name} → 回复[${reply.replyTo}]：${reply.text}`);
      }
      if (output.plan.skip) console.log(`本轮跳过：${output.plan.skipReason || '暂不接话'}`);
      for (const warning of output.warnings) console.error(`提示：${warning}`);
      console.log(`timings：${JSON.stringify(output.timings)}`);
      console.log(`本轮总耗时：${output.timings.totalMs}ms`);
    } catch (error) {
      if (!(error instanceof LLMError)) throw error;
      console.error(`错误[${error.code}]：${error.message}`);
      console.log(`本轮总耗时：${Math.round(performance.now() - roundStarted)}ms`);
      process.exitCode = 1;
      if (!error.retryable) break;
    }
  }
}

main().catch((error: unknown) => {
  // 不向终端传递原始异常、堆栈或响应体。
  if (error instanceof LLMError) console.error(`错误[${error.code}]：${error.message}`);
  else if (error instanceof ArgumentError) console.error(`参数错误：${error.message}`);
  else console.error('运行失败：请检查 server/ 下的角色卡、提示词文件和依赖是否完整。');
  process.exitCode = 1;
});
