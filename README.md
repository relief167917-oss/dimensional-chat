# 跨次元茶话会

与历史与文学角色的群聊茶话会。本地 `pnpm dev` 运行，不部署、不做静态导出。

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000 。

`pnpm build` 仅用于确认能编译，产物不用于部署。开发与构建默认走 webpack（`next dev --webpack` / `next build --webpack`），以便正确解析 `server/` 里 TypeScript ESM 的 `.js` 导入；不要改 `server/`。

## 配置智谱 API Key

密钥只从服务端 `process.env.ZHIPU_API_KEY` 读取，**绝不能**写进前端代码。

任选其一：

1. **推荐**：在仓库根目录创建 `.env.local`（已在 `.gitignore`）：

   ```bash
   ZHIPU_API_KEY=你的智谱密钥
   ```

2. 或设置环境变量后再启动：

   ```bash
   export ZHIPU_API_KEY=你的智谱密钥
   pnpm dev
   ```

也可复用 `server/.env`：先在 `server/` 写入 `ZHIPU_API_KEY=...`，再在启动前 `export $(grep -v '^#' server/.env | xargs)`，或把同一行复制到根目录 `.env.local`。Next 会自动加载根目录 `.env.local`。

没有 key 时发消息会返回友好错误（缺少密钥），可点「重试」。

## 当前范围（Step 2）

- 群聊页接入真实导演轮次 `POST /api/round` → `server/round` 的 `runRound`
- 消息 localStorage 持久化、清空聊天、错误重试
- 正在输入、@ 提及、深色模式（跟随系统）
- 后端逻辑在 `server/`，由 Codex 维护；前端不要改 `server/`
