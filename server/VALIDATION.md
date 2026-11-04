# 第一步验证记录

日期：2026-11-04（Asia/Shanghai）。分支：`codex/step-1-llm`。

## 自动验证

使用已有 Node.js v24.22.1（加入本次验证进程的 PATH）、pnpm 11.25.0：

- `pnpm install` 成功；`pnpm-workspace.yaml` 仅允许 npm 包 esbuild 的安装构建。
- `pnpm test`：4 个测试文件、22 项测试全部通过，单测及 CLI 测试不访问外网。
- `pnpm typecheck` 成功。
- CLI 测试覆盖 `--times 2`、两位角色的回复链、token 输出、无密钥和非法参数。
- `ZHIPU_API_KEY= pnpm round` 退出码 1，无堆栈，输出如下：

```text
错误[MISSING_API_KEY]：缺少 ZHIPU_API_KEY，请设置环境变量或填写 server/.env。
```

本地真实密钥仅保存在权限为 `600` 的 `server/.env`；Git 忽略该文件，不纳入交付提交。

## 真实 API 调用

已使用主理人提供的密钥调用固定免费型号 `glm-4.7-flash`，关闭深度思考，所有调用串行。经过间歇性平台繁忙后，最终完成一次真实导演调用和两次真实发言，退出码 0，总耗时 17,066ms，三次成功响应合计 3,131 tokens。以下均为实际模型输出；导演存在点名和意图方面的偏差，见末尾问题记录。

命令：`pnpm round "林黛玉，我决定从明天开始减肥，只请你一个人回我一句。"`

```text
=== 第 1/1 轮 ===
[导演] provider=zhipu 耗时=6832ms tokens=输入:1057 输出:164 总计:1221
导演 JSON：
{
  "skip": false,
  "topic_keywords": [
    "减肥",
    "茶话会",
    "呆子",
    "大圣",
    "回一句"
  ],
  "turns": [
    {
      "speaker": "zhu_bajie",
      "reply_to": "user_1",
      "intent": "用“人设”反驳群主的减肥决定，强调自己肚子大是因为“天生”，顺便调侃大圣没帮忙",
      "tone": "吐槽",
      "length": "medium"
    },
    {
      "speaker": "sun_wukong",
      "reply_to": "turn:0",
      "intent": "嘲笑八戒把减肥当借口，并想用“筋斗云”展示什么叫真正的速度和决心",
      "tone": "调侃",
      "length": "short"
    }
  ]
}
[发言:猪八戒] provider=zhipu 耗时=3189ms tokens=输入:897 输出:39 总计:936
猪八戒 → 回复[user_1]：这话怎么说的？俺这肚子是元帅给的，减肥？让猴哥去挑担吧，俺老猪实在扛不动了。
[发言:孙悟空] provider=zhipu 耗时=7039ms tokens=输入:937 输出:37 总计:974
孙悟空 → 回复[turn:0]：呆子，俺老孙一个筋斗十万八千里，也不见喊累。你那是怕胖，还是怕动？
本轮总耗时：17066ms
```

早先真实请求曾返回 HTTP 429。一次独立诊断返回业务错误码 `1305`，提示「该模型当前访问量过大，请您稍后再试」。另一次默认输入的真实运行已拿到导演 JSON 和八戒台词，但第二位发言人限流而中止；不会把中止当作完整成功。

一轮脚本真实运行输出（已执行 1 秒、2 秒退避，重试耗尽）：

```text
=== 第 1/1 轮 ===
[导演] 调用失败 耗时=4433ms tokens=未知 code=RATE_LIMIT
本轮总耗时：4437ms
错误[RATE_LIMIT]：智谱请求限流或模型繁忙，请稍后重试。
```

首次 `pnpm round` 也在约 25 秒后因 HTTP 429 退出。HTTP 429 统一归入 `RATE_LIMIT`，包括账户限流和本次模型繁忙；不是导演 JSON 校验失败，也未进入角色发言阶段。没有改用付费型号。

## Mock 完整流程输出

下面的导演、台词和 token 数均是测试夹具，用于验证程序链路；**不是模型生成结果，不能据此判断真实对话是否好笑或推断真实延迟、用量**。

复现命令（需 Node 在 PATH 中）：

```sh
ZHIPU_API_KEY=mock-validation-key node --import tsx --import ./llm/__tests__/fixtures/mock-fetch.mjs scripts/run-round.ts
```

```text
=== 第 1/1 轮 ===
[导演] provider=zhipu 耗时=8ms tokens=输入:100 输出:20 总计:120
导演 JSON：
{
  "skip": false,
  "topic_keywords": [
    "减肥",
    "拖延"
  ],
  "turns": [
    {
      "speaker": "sun_wukong",
      "reply_to": "user_1",
      "intent": "用取经经验调侃群主把行动拖到明天",
      "tone": "调侃",
      "length": "short"
    },
    {
      "speaker": "zhu_bajie",
      "reply_to": "turn:0",
      "intent": "接猴哥的话，自告奋勇监督却惦记省下的饭",
      "tone": "捧场",
      "length": "short"
    }
  ]
}
[发言:孙悟空] provider=zhipu 耗时=0ms tokens=输入:100 输出:20 总计:120
孙悟空 → 回复[user_1]：呆子减肥也挑明天。群主，你俩拜的是同一座懒山？
[发言:猪八戒] provider=zhipu 耗时=0ms tokens=输入:100 输出:20 总计:120
猪八戒 → 回复[turn:0]：猴哥莫急！群主少吃的那份，俺老猪替他受累。
本轮总耗时：11ms
```

## 当前问题与验收边界

1. 五项验收均已检查：安装与单测、真实 JSON/台词/耗时/用量、缺密钥报错、服务商解耦，以及提交范围只含 `server/`。真实完整成功一次不代表模型质量或平台可用性稳定。
2. 免费模型存在间歇性繁忙：三次串行请求仍可能在重试耗尽后中止，且没有失败请求的 token 统计。最长情况下，一次逻辑调用三次 20 秒超时再加两次退避约 63 秒。
3. 点名遵循不稳定：完整成功的这次输入只点名林黛玉，导演却选了八戒和悟空。zod 能验证角色合法、turn 数量和回复 id，无法仅凭这些结构检查保证语义遵循；本步没有新增点名识别器。
4. 导演的 intent 中出现“人设”一词，有出戏倾向；实际台词未出现该词。默认输入的一次真实发言还近似照搬了八戒卡里的示范句，原创性需要后续观察。按要求，本步不加出戏过滤。
5. 两次成功的导演 JSON 均通过结构校验，但样本太少，无法评价整体 JSON 稳定性。字数和其他语义要求仍依赖提示词；mock 的零毫秒发言不代表模型性能。
