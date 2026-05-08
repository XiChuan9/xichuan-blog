# 部署指南

[English deployment guide](DEPLOY.en.md) · [中文部署指南](DEPLOY.md)

XiChuan Blog 支持两条平行部署路径：

- `Vercel + Turso/libSQL + Vercel Blob`
- `OpenNext + Cloudflare Workers + D1 + R2`

Vercel 是当前推荐的免费计划友好路径，避免 Worker 体积限制；Cloudflare 路径保留给需要原生 D1/R2/Workers 能力的部署。

## Vercel 部署

### 1. 准备存储资源

在 Turso 创建一个数据库，拿到：

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

在 Vercel Project 的 Storage 中创建 Blob Store，拿到：

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
NEXT_PUBLIC_VERCEL_BLOB_ACCESS=public
```

博客公开媒体建议使用 public Blob Store；如果你明确需要 private Blob Store，把 `NEXT_PUBLIC_VERCEL_BLOB_ACCESS` 改为 `private`。

### 2. 配置环境变量

Vercel Project 至少配置：

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com
ADMIN_PASSWORD_HASH=pbkdf2-sha256$...
ADMIN_TOKEN_SALT=change-me-to-a-random-string
AI_CONFIG_ENCRYPTION_SECRET=change-me-to-another-random-string
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
NEXT_PUBLIC_VERCEL_BLOB_ACCESS=public
```

可选 AI：

```env
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

如果你仍想使用 Workers AI 模型，而不是切到外部 OpenAI 兼容供应商：

```env
ENABLE_WORKERS_AI=1
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
WORKERS_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
```

### 3. 本地验证

```bash
npm install
cp .env.example .env.local
npm run verify:vercel
```

### 4. 部署

把仓库导入 Vercel，Framework Preset 选择 Next.js。仓库根目录的 `vercel.json` 已设置：

- `buildCommand`: `npm run build:vercel`
- `installCommand`: `npm install`

基础 schema 会在首次请求自动初始化；不需要 `wrangler d1 execute`。

### Vercel 运行时说明

- `lib/cloudflare.ts` 仍是兼容入口，但在 Vercel 下会返回 Turso / Blob / REST Workers AI 组装出的等价 env。
- `Turso` 适配器实现了项目现有的 `db.prepare().bind().all()/first()/run()` 接口，所以仓储层不需要改成另一套 ORM。
- `/api/uploads` 保留原有服务端上传路径；浏览器上传超过 4MB 时会自动改走 `/api/uploads/client` 的 Vercel Blob 客户端直传。
- `/api/images/...` 保持统一分发路径，文章内容不需要保存 Blob 原始 URL。
- Queues、Vectorize 是可选增强；没有绑定时走 inline / FTS / 规则召回。

## Cloudflare 部署

## 首次部署

### 1. 安装依赖和环境变量

```bash
npm install
cp .env.example .env.local
```

至少填写：

```env
ADMIN_PASSWORD_HASH=pbkdf2-sha256$...
ADMIN_TOKEN_SALT=change-me-to-a-random-string
AI_CONFIG_ENCRYPTION_SECRET=change-me-to-another-random-string
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 初始化资源

```bash
npm run cf:init -- --site-url=https://your-domain.com
```

如果还要启用公共缓存 KV：

```bash
npm run cf:init -- --site-url=https://your-domain.com --with-kv
```

这一步会生成本地的 `wrangler.local.toml`，并自动写入真实 D1 / R2 / KV 绑定。

### 4. 设置 secrets

```bash
npm run password:hash -- "your-admin-password"
npx wrangler secret put ADMIN_PASSWORD_HASH -c wrangler.local.toml
npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
npx wrangler secret put AI_CONFIG_ENCRYPTION_SECRET -c wrangler.local.toml
```

如需外部 AI：

```bash
npx wrangler secret put AI_API_KEY -c wrangler.local.toml
```

### 5. 生成类型并部署

```bash
npm run cf-typegen
npm run deploy:cloudflare
```

## 本地 Worker 预览

```bash
npm run preview
```

脚本会优先读取 `wrangler.local.toml`。模板仓库里的 `wrangler.toml` 不带真实资源绑定，不能直接拿来部署生产。

## 日常更新

```bash
git pull
npm install
npm run verify
npm run deploy
```

## 常见问题

### `npm run deploy` 报缺少 D1 或 R2

先执行：

```bash
npm run cf:init -- --site-url=https://your-domain.com
```

### 后台登录提示鉴权未配置完成

至少补齐：

```bash
npm run password:hash -- "your-admin-password"
npx wrangler secret put ADMIN_PASSWORD_HASH -c wrangler.local.toml
npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
```

### AI Provider 已保存的 Key 无法解密

通常是 `AI_CONFIG_ENCRYPTION_SECRET` 或 `ADMIN_TOKEN_SALT` 被改了。建议固定 `AI_CONFIG_ENCRYPTION_SECRET`，不要和 token salt 复用。

### RSS / sitemap / canonical 指向错域名

检查：

- `.env.local`
- `wrangler.local.toml`

两处的 `NEXT_PUBLIC_SITE_URL` 必须一致。
