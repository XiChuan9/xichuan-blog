# XiChuan Blog

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/XiChuan9/xichuan-blog)
[![Use this template](https://img.shields.io/badge/GitHub-Use%20this%20template-111111?logo=github)](https://github.com/XiChuan9/xichuan-blog/generate)

如果你也想拥有一个真正属于自己的学习、写作、分享阵地，而不是把内容完全寄托在平台算法上，这个项目就是为此做的。

XiChuan Blog 不是一个只会渲染 Markdown 的静态模板，而是一套完整的博客系统：前后台双编辑器、AI 写作辅助、AI 生图、主题系统、全文检索、API Token、外部发布生态都已经接好，目标就是让你更容易持续写下去。

- 在线示例：<https://xichuan-blog.vercel.app/>
- 介绍文章：<https://xichuan-blog.vercel.app/xichuan-blog>
- 当前仓库：<https://github.com/XiChuan9/xichuan-blog>

## 为什么值得做成自己的站

- 自媒体账号可能被封，平台流量也可能波动，但自己的站点不会
- 写作系统应该足够轻，打开就能写，而不是被后台流程打断
- AI 最该服务的是摘要、标签、封面、slug、生图这些重复工作
- 博客不该只是展示页，还应该是你的长期知识资产

## 你会得到什么

- 前台、后台都能编辑，所见即所得，接近飞书 / Notion 的写作体验
- 四套首页主题，移动端友好，开箱即用
- Bubble Menu + Ask AI，选中文本就能改写、润色、扩写、翻译
- AI 自动处理摘要、标签、SEO slug、封面图
- AI 生图模型和模板配置、最近生成记录、插入和替换工作流
- 图片右键菜单：下载、设为封面、对齐、裁剪、参考生图
- 发布状态：公开、草稿、密码访问、链接访问
- 默认初始化配置：主题、导航、字体、AI 文本模型模板、AI 生图模型模板
- Cloudflare Workers + D1 + R2 部署，或 Vercel + Turso + Blob 平行部署，不需要自己维护服务器和 CDN

## 截图预览

### 四套首页主题

![四套首页主题](docs/screenshots/home-themes.webp)

### 编辑器与所见即所得写作

![编辑器总览](docs/screenshots/editor-overview.webp)

### Ask AI / Bubble Menu

![Ask AI](docs/screenshots/ask-ai.png)

### 后台设置与主题、代码、API Token 管理

![后台设置](docs/screenshots/admin-settings.webp)

### 多种发布状态

![发布状态](docs/screenshots/publish-states.png)

### AI 模型与生图配置

![图片模型配置](docs/screenshots/image-provider.png)

## 配套生态也一起开源了

这个仓库不只开源博客主站，也把外部发布工具一起放进来了。你可以把“写作入口”放在最顺手的地方，但最终都回到同一个博客后台。

- [`ecosystem/chrome-clipper`](ecosystem/chrome-clipper/README.md)：浏览器网页剪藏，直接进入博客草稿箱
- [`ecosystem/obsidian-publisher`](ecosystem/obsidian-publisher/README.md)：从 Obsidian 一键发布到博客
- [`ecosystem/xichuan-blog-publish-skill`](ecosystem/xichuan-blog-publish-skill/README.md)：通过 Claude Skill / 命令工作流直接发布
- [`ecosystem/README.md`](ecosystem/README.md)：生态工具总览

## 部署到 Vercel

这个版本保留原有功能，同时新增 Vercel 平行运行时：

- 数据库：Turso / libSQL，保持 SQLite / D1 风格 SQL，不重写业务仓储层
- 文件与媒体：Vercel Blob，继续通过 `/api/uploads` 与 `/api/images/...` 使用统一链路
- 大文件上传：超过 Vercel Function 请求体限制时自动走 Blob 客户端直传
- AI：继续支持后台 OpenAI 兼容供应商；如需 Workers AI，可用 Cloudflare REST 凭据保留原通道
- 后台任务：没有 Queues 时回退为非阻塞 Promise / inline 执行

Vercel 环境变量至少配置：

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com
ADMIN_PASSWORD=change-me
ADMIN_TOKEN_SALT=change-me-to-a-random-string
AI_CONFIG_ENCRYPTION_SECRET=change-me-to-another-random-string

TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
NEXT_PUBLIC_VERCEL_BLOB_ACCESS=public
```

部署步骤：

```bash
npm install
cp .env.example .env.local
npm run verify:vercel
```

然后把仓库导入 Vercel，Framework Preset 选择 Next.js。仓库已经包含 `vercel.json`，默认构建命令是 `npm run build:vercel`。

首次访问时会自动创建基础表、索引、FTS、默认分类和默认站点设置；AI Provider、AI 生图动作、文章元数据生成器等配置会在对应功能首次使用时自动补齐。已有 Cloudflare D1 数据可先导出为 SQLite SQL，再导入 Turso。

## 一键部署到 Cloudflare

直接点击上面的 `Deploy to Cloudflare` 按钮即可。

这个模板已经补好了适合 Deploy Button 的配置：

- Cloudflare 会读取仓库里的 Worker 配置
- 自动创建需要的 `D1` / `R2` 绑定
- 使用仓库里的自定义 deploy script
- 部署时自动应用数据库 schema 和模板默认配置

部署时建议准备这些值：

- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_PASSWORD`
- `ADMIN_TOKEN_SALT`
- `AI_CONFIG_ENCRYPTION_SECRET`
- `AI_API_KEY`（可选）

如果你更想手动掌控 Cloudflare 资源，也可以走 CLI：

```bash
npm install
cp .env.example .env.local
npx wrangler login
npm run cf:init -- --site-url=https://your-domain.com
npm run deploy:cloudflare
```

## 本地开发

```bash
git clone https://github.com/XiChuan9/xichuan-blog.git
cd xichuan-blog
npm install
cp .env.example .env.local
npm run dev
```

常用入口：

- 首页：`/`
- 后台：`/admin`
- 编辑器：`/editor`

如果你要在 Worker 运行时本地预览：

```bash
npm run preview
```

## 默认初始化内容

首次初始化后，模板会自动带上这些基础能力：

- 默认导航
- 默认主题与字体
- 默认分类
- AI 文本模型配置模板
- AI 生图模型配置模板
- 文章摘要、标签、slug、封面生成器
- 编辑器 Ask AI 预设动作

所有 API Key 都不会进入仓库，首次部署时通过 Cloudflare secret 或后台配置补齐。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- OpenNext for Cloudflare
- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- Novel / Tiptap

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | Next.js 本地开发 |
| `npm run build` | 构建应用 |
| `npm run build:vercel` | Vercel 模式构建应用 |
| `npm run verify:quick` | 跑 lint、test、build |
| `npm run verify:vercel` | 跑 lint、test、Vercel 模式 build |
| `npm run verify` | 跑完整验证链路 |
| `npm run cf:init` | 初始化 Cloudflare 资源和模板默认设置 |
| `npm run preview` | Worker 运行时预览 |
| `npm run deploy` | 部署到 Cloudflare Workers（兼容旧命令） |
| `npm run deploy:cloudflare` | 部署到 Cloudflare Workers |

## 作者

- XiChuan
- GitHub：<https://github.com/XiChuan9>
- X / Twitter：<https://x.com/vista8>
- Blog：<https://xichuan-blog.vercel.app/>
