# 跨次元茶话会 · 第二步后端

纯 Node.js / TypeScript 模块，固定免费智谱 `glm-4.7-flash`，`thinking: { type: "disabled" }`。没有新增数据库、HTTP 框架或前端路由。

## 安装与 CLI

需要 Node.js 20+、pnpm 11，在 `server/` 中运行：

```sh
pnpm install
# 仅当 .env 不存在时执行，然后在本地填写密钥：
cp .env.example .env
pnpm test
pnpm typecheck
pnpm round "林黛玉，我决定减肥，只请你回我一句"
pnpm round --times 3 "李白和鲁迅你们怎么看减肥"
```

密钥只从 `process.env.ZHIPU_API_KEY` 读取；仅 CLI 使用 dotenv 加载本地 `.env`，已有环境变量优先。`.env` 不进入 Git。CLI 默认历史为空，每轮独立；可重试的服务商错误会记下该轮失败并继续剩余对比轮次，任一轮失败则最终退出码为 1，非重试错误停止运行。没有密钥时以中文提示退出，不打印堆栈。

本机 Codex 的 Node 不在默认 PATH 中，验证时用已有运行时，未修改系统设置：

```sh
export PATH="/Users/relief/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

## 前端调用接口

`server/round/index.ts` 导出：

```ts
export async function runRound(
  input: RoundInput,
  deps?: { call?: typeof callLLM },
): Promise<RoundOutput>;
```

`server/round/types.ts` 直接复用 `lib/types.ts` 中的 `Message`、`DirectorPlan`、`DirectorTurn` 和 `Group` 类型，避免手写两份字段。

```ts
type RoundInput = {
  group: Pick<Group, 'id' | 'name' | 'ownerNickname' | 'memberIds'>;
  history: Message[];
  ownerMessage: Message;
};
type RoundOutput = {
  plan: DirectorPlan;
  replies: Message[];
  timings: {
    directorMs: number;
    speakersMs: number[];
    retryWaitMs: number;
    totalMs: number;
  };
  warnings: string[];
};
```

供 Node 服务端代码导入；本步没有编写 Next.js API 路由。输入须包含已生成 id / createdAt 的群主消息，senderType 为 owner，且 groupId 匹配。函数仅取同群最近 20 条历史，去除已重复包含的群主消息，不写入假历史。

返回计划使用 `skipReason` / `topicKeywords` / `replyTo`。回复消息包含真实 UUID、groupId、senderType=character、senderId、生成时刻 createdAt。replyTo 只指向群主或本轮上一条实际发出的回复，不把 `turn:0` 放进 Message。deliverAt 从函数完成时刻 +1.2 秒开始，后一条再累加前一条台词按每字 80ms 计算、限制在 1–3 秒的阅读间隔。

JSON 角色卡静态 import 并通过 zod 校验，提示词由 `.ts` 导出字符串；模块内部没有基于文件路径的运行时读取。已用 esbuild 进行服务端打包和动态导入烟测；尚未新增或验证实际 Next.js 路由。

## 编排与过滤

- 7 位角色：孙悟空、猪八戒、林黛玉、李白、苏轼、诸葛亮、鲁迅。每张卡都有 aliases、4 条笑点线索、2–3 段示范；旧卡补齐与四位新成员的关系。
- `mentions.ts` 识别名字、别名和其他卡称呼该人的 nickname，只匹配当前群成员。导演提示词显式注明必须入选名单，解析后再次在本地修正，替换未点名者或插入；“只请某人”或唯一被点名者后的“只请你”只保留一人。
- 点名超过两人时按文本提及顺序保留前两位并给出 warning。导演明确 skip 时保留跳过决定，不强行生成台词。
- 导演每人仅收到 id、名字、tagline，关系仅保留本轮点名或最近发言相关成员之间的内容。topicKeywords 最多 3 个，输出上限 250 tokens。
- `ooc.ts` 在本地清洗 intent；不因此重调导演。台词命中出戏词时额外生成一次，仍命中则丢弃。若前一条被丢弃，后者会改为直接回应群主。
- 过滤词：AI、人工智能、模型、语言模型、助手、人设、提示词、prompt、设定、角色扮演、扮演、作为一个。英文 AI / prompt 按词忽略大小写匹配，兼容全角字符；这是词表过滤，不保证覆盖所有语义出戏。
- 发言提示词不再包含【禁用措辞】词表。short 上限 80 tokens、medium 150；字数通过提示词约束，不硬截断台词。
- 导演结构错误额外重试一次，仍失败则单角色降级，再执行点名修正。该重试也受整轮预算限制。台词 JSON 解析失败沿用第一步的原文回退，仍经过出戏过滤。

## 429、预算与观测

单次请求默认 15 秒。HTTP 429 或业务码 1302 / 1305（含 HTTP 200）归为 RATE_LIMIT；5xx、网络错误、请求超时也可重试。每次逻辑调用最多额外重试 2 次：有 Retry-After 时读取秒数或 HTTP 日期，否则等待 1.5 秒 / 4 秒，另加 0–500ms 抖动。普通 4xx 不重试。

整轮预算 45 秒，取消信号贯穿请求与退避等待；超时返回已生成的部分和中文 warning。其他 LLMError 按安全 code/message 向上抛，不返回普通错误之前的部分台词。注入的 call 应遵循 options.signal；函数会在预算结束时停止等待，但无法撤销一个完全忽略 signal 的自定义实现内部副作用。

callLLM 使用进程内串行队列，即使同时触发多轮，也只有一个逻辑调用执行，退避期间不释放队列。每轮先把第一条实际台词加入上下文再生成第二条；排队同样计入45秒预算。timings 的 directorMs / speakersMs 包含对应阶段全部调用、排队和退避等待；retryWaitMs 是这些阶段中的退避子项，不能重复相加。speakersMs 按计划尝试顺序排列，包含重生成、丢弃或预算中止的发言人。totalMs 是整轮总耗时。

CLI 额外打印每次成功调用的 token 用量、逻辑调用耗时和 retry 等待；失败请求的用量未知，不推算为零。warnings 使用固定中文说明，不含密钥或原始响应。

## 验证

`pnpm test` 全部通过 mock fetch，不访问外网；覆盖点名修正、出戏过滤、Retry-After / 1305、取消、45 秒部分返回、消息链与投递时间、七张卡的 schema，以及原有凭据安全和 CLI 测试。真实结果追加在 [VALIDATION.md](./VALIDATION.md) 的“第二步”一节。

型号的免费状态见[智谱官方模型概览](https://docs.bigmodel.cn/cn/guide/start/model-overview)。没有切换其他型号或付费模型。
