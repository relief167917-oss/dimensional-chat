# 跨次元茶话会 · 第一步后端验证

独立命令行实验：群主输入 → 导演安排 1–2 位角色 → 各角色按顺序发言。只有孙悟空、猪八戒、林黛玉三张角色卡；没有数据库、登录、HTTP 服务或前端。

## 安装与运行

需要 Node.js 20+、pnpm 11。先确认终端的 `node --version` 能运行；所有命令在 `server/` 目录执行：

```sh
pnpm install
cp .env.example .env
```

在本地 `.env` 的 `ZHIPU_API_KEY=` 后填写密钥，或从终端设置同名环境变量。环境变量优先于 `.env`；密钥只从 `process.env.ZHIPU_API_KEY` 读取。`.env` 已排除 Git 跟踪，请勿将密钥放进源码或命令行参数。

```sh
pnpm round
pnpm round "我决定从明天开始减肥，谁来监督我？"
pnpm round "孙悟空，今天又加班了。" --times 3
pnpm round --help
pnpm test
pnpm typecheck
```

已有本地 `.env` 时不要执行覆盖它的复制命令。没有密钥会输出中文错误并以状态码 1 退出，不打印堆栈。

仅调用免费型号 **`glm-4.7-flash`**，固定在 `llm/zhipu.ts` 中；请求携带 `thinking: { type: "disabled" }`，不自动改用其他型号或付费模型。[智谱官方模型概览](https://docs.bigmodel.cn/cn/guide/start/model-overview)将其列为免费文本模型。[型号说明与 API 示例](https://docs.bigmodel.cn/cn/guide/models/free/glm-4.7-flash)。

## 文件与行为

- `llm/provider.ts`：服务商接口、消息、用量与统一 `LLMError`。
- `llm/zhipu.ts`：使用 Node 原生 `fetch`，无需引入只为一个接口使用的 SDK；`AbortController` 控制每次请求的 20 秒超时。
- `llm/index.ts`：`callLLM()` 按列表顺序调用服务商。可重试错误耗尽当前服务商重试后才换下一家；不可重试错误立即抛出。新增服务商只需实现 `LLMProvider` 并加入列表，脚本不变。目前列表仅含智谱。
- `prompts/`：导演、发言的 system/user 模板及单次占位符替换函数。
- `characters/`：三张 JSON 人设卡及加载校验。
- `scripts/run-round.ts`：加载环境变量、解析参数、串行运行；`scripts/round.ts` 负责一轮编排和发言。
- `llm/__tests__/`：mock `fetch` 的错误处理测试，以及编排校验、降级、服务商切换和上下文测试；单测不使用真实密钥，不调用外网。

所有模型调用及 `--times N` 的各轮均串行执行，没有新增限流系统。每轮重置同样的四条虚构历史消息，便于比较同一句输入的不同结果。

导演温度 0.7、JSON 模式；使用 zod 校验角色、最多两个 turn、消息引用、至少一条直接回应群主，以及输出字段的格式。第一条不得引用尚未生成的 `turn:0`。不合法时额外调用导演一次，仍不合法则随机一个角色直接回应群主。`skip: true` 时不生成台词。

发言温度 0.95，也启用 JSON 模式。第一位台词生成后才进入第二位上下文；第二位可通过 `turn:0` 接话。`{"text":"..."}` 无法解析或缺少有效 text 时保留原文，终端给出提示。字数、角色点名和出戏等语义规则由提示词约束，本步不做文本过滤；三个角色同时被点名与“最多两人”有规则冲突，需主理人观察效果。

## 错误与时间统计

- `TIMEOUT`、`RATE_LIMIT`（HTTP 429 或智谱错误码 1302）、`SERVER_ERROR`（5xx）、`NETWORK_ERROR`：最多额外重试两次，分别等待 1 秒、2 秒。
- 普通 4xx → `CLIENT_ERROR`，不重试；空台词 → `EMPTY_RESPONSE`；非 JSON 协议响应 → `INVALID_RESPONSE`；缺密钥 → `MISSING_API_KEY`。
- 错误只使用固定中文文案与分类，不传递请求头、服务商原始报错或异常 cause。鉴权请求禁止跟随重定向。
- 每次逻辑调用打印耗时与 token 用量；耗时包含内部重试和退避，用量为最终成功响应的服务商统计，不推算失败请求的用量。缺少用量标为“未知”。失败时也打印耗时，本轮最后打印总耗时。
- 单次逻辑调用如果三次都超时，可耗时约 63 秒；导演 JSON 校验重试另算，不等于无限重试。

真实运行记录及已知限制见 [VALIDATION.md](./VALIDATION.md)。完成本步后不自动执行下一步。

本次 Codex 环境的 Node 未加入默认 PATH，验证时使用已有的内置运行时（未修改系统设置）：

```sh
export PATH="/Users/relief/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

其他机器只需正常安装 Node.js 20+，不需要使用此绝对路径。
