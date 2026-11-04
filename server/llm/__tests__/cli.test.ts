import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const cwd = fileURLToPath(new URL('../../', import.meta.url));
const argv = ['--import', 'tsx', '--import', './llm/__tests__/fixtures/mock-fetch.mjs', 'scripts/run-round.ts'];

it('CLI --times 2 独立连跑两轮，并打印导演、台词、用量和两次总耗时', () => {
  const output = execFileSync(process.execPath, [...argv, '明天减肥', '--times', '2'], {
    cwd, env: { ...process.env, ZHIPU_API_KEY: 'cli-test-key' }, encoding: 'utf8',
  });
  expect(output).toContain('第 1/2 轮');
  expect(output).toContain('第 2/2 轮');
  expect(output.match(/导演 JSON/g)).toHaveLength(2);
  expect(output.match(/本轮总耗时/g)).toHaveLength(2);
  expect(output).toMatch(/猪八戒 → 回复\[(?!turn:0)[^\]]+\]/);
  expect(output).toContain('tokens=输入:100 输出:20 总计:120');
  expect(output).not.toContain('cli-test-key');
});

it('缺少密钥时以状态码 1 退出，输出中文提示且没有堆栈', () => {
  const result = spawnSync(process.execPath, [...argv], {
    cwd, env: { ...process.env, ZHIPU_API_KEY: '' }, encoding: 'utf8',
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('缺少 ZHIPU_API_KEY');
  expect(result.stderr).not.toMatch(/\n\s+at /);
  expect(result.stdout).not.toContain('导演 JSON');
});

it('--times 不合法时不进入模型流程', () => {
  const result = spawnSync(process.execPath, [...argv, '--times', '0'], {
    cwd, env: { ...process.env, ZHIPU_API_KEY: 'cli-test-key' }, encoding: 'utf8',
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('--times 必须是正整数');
  expect(result.stdout).not.toContain('导演 JSON');
});
