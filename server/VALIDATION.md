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


## 第二步

日期：2026-11-04（Asia/Shanghai）。分支 `codex/step-2-round` 从 `origin/main` 的 `5555e9b` 创建；第一步前端 PR #1、后端 PR #2 均已由主理人合并。本步只修改 server/，不合并本步 PR。

### 完成范围与接口

- 点名识别支持 name、aliases、关系 nickname；解析后强制补选，识别“只请某人”和单个被点名者后的“只请你”。最多两人，明确 skip 时保留跳过。
- intent 出戏措辞本地清洗；台词重生成一次后仍命中则丢弃，断开的回复链改回群主。
- 15秒单次超时、45秒整轮预算、Retry-After、1302/1305、1.5s/4s退避加抖动；进程内 callLLM 队列保证同时调用多轮时仍无并发。
- 七张静态 JSON 卡通过 zod；提示词改为 TS 字符串。核心导入没有 fs 路径读取和 dotenv。
- 直接复用 lib/types.ts 的前端类型，消息时间为 ISO 字符串，实际 Message.replyTo 不含 turn:0，deliverAt 递增。

最终导出：

```ts
export async function runRound(
  input: RoundInput,
  deps?: { call?: typeof callLLM },
): Promise<RoundOutput>;
```

### 自动验证

- `cd server && pnpm test`：5个测试文件，62项全部通过；所有网络调用均被 mock，无外网单测。
- `cd server && pnpm typecheck`：通过。
- 服务端 esbuild 打包、动态 import runRound 烟测：通过。不是实际 Next.js API 路由集成验收，本步没有改前端。
- 测试覆盖别名/昵称/独占点名、强制修正、intent清洗、台词重试/丢弃、Retry-After秒数/日期、任意HTTP状态下1305、45秒部分返回与取消等待、跨轮最大并发1、消息链/投递时间、七张卡及CLI。

### 真实运行结果

均使用本地密钥、免费 glm-4.7-flash、thinking disabled，串行调用。以下为真实输出，不是 mock；失败请求的 token 用量未知，不计为零。

| 输入/轮次 | 状态 | 总耗时 | 成功响应中已知 tokens | 退避等待 |
|---|---|---:|---:|---:|
| 只请林黛玉（最后一次复验） | 成功，仅黛玉1条 | 17,360ms | 1,522 | 11,968ms |
| 李白和鲁迅，第1轮 | 成功，两人均回复 | 15,779ms | 3,291 | 7,386ms |
| 李白和鲁迅，第2轮 | 鲁迅重试耗尽，抛RATE_LIMIT | 10,824ms | 已知1,545，失败部分未知 | 已知5,817ms |
| 李白和鲁迅，第3轮 | 成功，两人均回复 | 11,653ms | 2,393 | 6,086ms |

`--times 3` 实际执行了三轮，第二轮失败后继续第三轮，整条命令退出码1用于表示有失败。三轮都已选择并尝试李白、鲁迅。第1轮导演发生一次结构校验重试，该次成功响应的用量包含在3291中。directorMs / speakersMs 包含各自阶段的等待，retryWaitMs 是其中子项，不重复相加。

#### 只请黛玉 · 完整成功输出

命令：`pnpm round "林黛玉，我决定减肥，只请你回我一句"`

```text
$ tsx scripts/run-round.ts '林黛玉，我决定减肥，只请你回我一句'

=== 第 1/1 轮 ===
[retry] director 第1次退避 1676ms code=RATE_LIMIT
[retry] director 第2次退避 4375ms code=RATE_LIMIT
[director] provider=zhipu 耗时=9077ms tokens=输入:708 输出:80 总计:788
[retry] speaker:林黛玉 第1次退避 1912ms code=RATE_LIMIT
[retry] speaker:林黛玉 第2次退避 4005ms code=RATE_LIMIT
[speaker:林黛玉] provider=zhipu 耗时=8276ms tokens=输入:705 输出:29 总计:734
导演 JSON：
{
  "skip": false,
  "topicKeywords": [
    "减肥",
    "嘴硬",
    "吃"
  ],
  "turns": [
    {
      "speaker": "lin_daiyu",
      "replyTo": "a280c99b-ad8f-4f77-b3ae-4580a8331f8d",
      "intent": "用薄命梗回击减肥",
      "tone": "调侃",
      "length": "short"
    }
  ]
}
林黛玉 → 回复[a280c99b-ad8f-4f77-b3ae-4580a8331f8d]：倒像是要把身子里的慈悲都减了去，只留一副空架子么？
timings：{"directorMs":9081,"speakersMs":[8277],"retryWaitMs":11968,"totalMs":17360}
本轮总耗时：17360ms
```

#### 李白和鲁迅 · 三轮原始终端输出

命令：`pnpm round --times 3 "李白和鲁迅你们怎么看减肥"`

```text
$ tsx scripts/run-round.ts --times 3 '李白和鲁迅你们怎么看减肥'

=== 第 1/3 轮 ===
[retry] director 第1次退避 1759ms code=RATE_LIMIT
[retry] director 第2次退避 4095ms code=RATE_LIMIT
[director] provider=zhipu 耗时=8800ms tokens=输入:741 输出:163 总计:904
[director] provider=zhipu 耗时=2132ms tokens=输入:772 输出:129 总计:901
[speaker:李白] provider=zhipu 耗时=1205ms tokens=输入:671 输出:26 总计:697
[retry] speaker:鲁迅 第1次退避 1532ms code=RATE_LIMIT
[speaker:鲁迅] provider=zhipu 耗时=3633ms tokens=输入:742 输出:47 总计:789
导演 JSON：
{
  "skip": false,
  "topicKeywords": [
    "减肥",
    "肚子",
    "豪言"
  ],
  "turns": [
    {
      "speaker": "li_bai",
      "replyTo": "8514c805-7d27-4a56-a3cf-25a9027cc7a2",
      "intent": "展示肚子吐槽减肥",
      "tone": "调侃",
      "length": "short"
    },
    {
      "speaker": "lu_xun",
      "replyTo": "8514c805-7d27-4a56-a3cf-25a9027cc7a2",
      "intent": "嘲讽豪言落地",
      "tone": "吐槽",
      "length": "medium"
    }
  ]
}
李白 → 回复[8514c805-7d27-4a56-a3cf-25a9027cc7a2]：我这身子骨是星辰铸的，减什么肥！且尽此杯！
鲁迅 → 回复[8514c805-7d27-4a56-a3cf-25a9027cc7a2]：这身子骨若是星辰铸的，怕是也经不住这名为杯的石头。且把豪言收一收，别把我的稿纸也弄脏了。
提示：导演编排结构校验失败（1/2）。
timings：{"directorMs":10935,"speakersMs":[1205,3633],"retryWaitMs":7386,"totalMs":15779}
本轮总耗时：15779ms

=== 第 2/3 轮 ===
[director] provider=zhipu 耗时=1964ms tokens=输入:739 输出:112 总计:851
[speaker:李白] provider=zhipu 耗时=1765ms tokens=输入:671 输出:23 总计:694
[retry] speaker:鲁迅 第1次退避 1612ms code=RATE_LIMIT
[retry] speaker:鲁迅 第2次退避 4205ms code=RATE_LIMIT
[speaker:鲁迅] 调用失败 耗时=7087ms tokens=未知 code=RATE_LIMIT
错误[RATE_LIMIT]：智谱请求限流或模型繁忙，请稍后重试。
本轮总耗时：10824ms

=== 第 3/3 轮 ===
[director] provider=zhipu 耗时=1790ms tokens=输入:739 输出:110 总计:849
[retry] speaker:李白 第1次退避 1614ms code=RATE_LIMIT
[retry] speaker:李白 第2次退避 4472ms code=RATE_LIMIT
[speaker:李白] provider=zhipu 耗时=7908ms tokens=输入:674 输出:40 总计:714
[speaker:鲁迅] provider=zhipu 耗时=1952ms tokens=输入:778 输出:52 总计:830
导演 JSON：
{
  "skip": false,
  "topicKeywords": [
    "减肥",
    "肚子",
    "酒量"
  ],
  "turns": [
    {
      "speaker": "li_bai",
      "replyTo": "5a8cf7ac-555f-4adb-85d0-972bb9ab8ac4",
      "intent": "反驳说减肥伤身且浪费酒肉",
      "tone": "调侃",
      "length": "short"
    },
    {
      "speaker": "lu_xun",
      "replyTo": "turn:0",
      "intent": "吐槽李白是嘴强王者",
      "tone": "吐槽",
      "length": "medium"
    }
  ]
}
李白 → 回复[5a8cf7ac-555f-4adb-85d0-972bb9ab8ac4]：群主，拿饭量换皮囊，岂非买椟还珠？且尽此杯，我的肉是自家酿的！🍷
鲁迅 → 回复[effef6d9-fa9d-498e-af2a-e2fb16d65308]：我想肉若是自家酿的，定是含了过度的骄傲，因为只有骄傲酿不出好酒。我大概也和太白一样，只管在空碗里洗刷不肯停笔。
timings：{"directorMs":1791,"speakersMs":[7908,1953],"retryWaitMs":6086,"totalMs":11653}
本轮总耗时：11653ms
[ELIFECYCLE] Command failed with exit code 1.
```

#### 早先失败的复验（未计作成功）

“只请黛玉”前两次复验分别在导演阶段和黛玉发言阶段限流。第一次未取得任何成功模型输出；第二次导演成功（825 tokens），发言失败，耗时9675ms。第二次原始输出如下：

```text
$ tsx scripts/run-round.ts '林黛玉，我决定减肥，只请你回我一句'

=== 第 1/1 轮 ===
[director] provider=zhipu 耗时=1508ms tokens=输入:714 输出:111 总计:825
[retry] speaker:林黛玉 第1次退避 1696ms code=RATE_LIMIT
[retry] speaker:林黛玉 第2次退避 4320ms code=RATE_LIMIT
[speaker:林黛玉] 调用失败 耗时=8162ms tokens=未知 code=RATE_LIMIT
错误[RATE_LIMIT]：智谱请求限流或模型繁忙，请稍后重试。
本轮总耗时：9675ms
[ELIFECYCLE] Command failed with exit code 1.
```

### 仍存在的问题

1. 免费模型繁忙依然是主要延迟来源。完整黛玉一轮17.36秒中约11.97秒在退避；合理重试不能保证每次服务可用，且不会切付费型号。
2. 三轮对比中导演有一次结构校验失败，需要额外调用；250 tokens的压缩不能保证所有输出都稳定，失败后有降级和点名修正。
3. 词表过滤不是语义审核；字数依赖提示词，台词仍可能拗口或借用示范风格。鲁迅第三轮部分措辞不够自然，不能仅凭程序测试宣称笑点已经稳定。
4. 超过两人点名只保留前两位并告警；导演明确 skip 时不强行发言。普通LLMError按任务书向上抛，因此该类错误不会返回此前生成的部分；只有45秒预算截止返回部分结果。
5. 仅完成可供前端服务端代码 import 的接口，未编写Next.js路由或改UI。密钥仍只在被忽略的本地 .env，未放入代码、日志或提交。
