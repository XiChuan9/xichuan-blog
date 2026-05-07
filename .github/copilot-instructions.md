# XiChuan Blog - AI 协作指南

## 项目概述

XiChuan Blog 是一个开源 Next.js 博客系统，目标是在 Vercel 和 Cloudflare 两条部署路径上保持同一套应用代码可用。项目内置后台写作、TipTap/Novel 编辑器、媒体上传、主题配置、AI 供应商配置、文章元数据生成、公众号 Bridge 发布和 Obsidian 发布插件。

## 技术栈

- **前端**：Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **编辑器**：Novel / TipTap
- **Vercel 推荐运行时**：Turso/libSQL + Vercel Blob
- **Cloudflare 兼容运行时**：Cloudflare D1 + R2 + KV + OpenNext
- **AI**：OpenAI-compatible providers、Workers AI REST fallback、可配置图像供应商
- **部署**：Vercel 为主，Cloudflare Pages/Workers 保持兼容

## 工程原则

### 运行时兼容

- 业务代码优先依赖 `CloudflareEnv` 形状和本项目 runtime adapter，不在路由里直接假设具体平台。
- Vercel 专用 SDK 只能动态导入，避免 Cloudflare 构建解析失败。
- Cloudflare 部署脚本会重复执行 `db/schema.sql`，schema 必须保持幂等。
- Turso/D1 的 SQL 行为差异要在 repository 或 runtime adapter 层处理。

### 安全默认值

- 后台 API 必须先鉴权，再处理写入、上传或外部请求。
- 不把数据库、SDK、网络异常原文作为 500 响应返回客户端；详细信息只写服务端日志。
- 外部 Base URL 必须使用公开 HTTPS 地址，不能包含凭据，不能指向 localhost 或内网地址。
- 上传文件名和编辑器插入内容不能拼接 HTML 字符串；优先使用结构化编辑器节点。
- SVG 上传默认禁用，除非后续引入严格消毒和独立下载响应策略。

### 数据库与搜索

- `lib/repositories/schema.ts` 是运行时自举和修复逻辑；`db/schema.sql` 是 Cloudflare 部署引导逻辑，两者要同步。
- `posts_fts` 使用 FTS5 external-content 表，更新和删除触发器必须使用特殊 `delete` 行语义。
- 搜索可以在 FTS 不可用时回退到 LIKE，但 LIKE 查询要转义 `%` 和 `_`。

### 前端体验

- 这是面向写作和阅读的工具型博客，不做营销落地页。
- 后台界面优先稳定、密集、可扫描；不要引入装饰性卡片堆叠或大面积渐变背景。
- 文章阅读体验保持内容优先，避免会遮挡正文或造成布局跳动的交互。

## 常用命令

- `npm run verify:quick`：lint、测试、默认 Next build
- `npm run verify:vercel`：lint、测试、Vercel runtime build
- `npm run verify`：lint、测试、Cloudflare OpenNext build
- `npm run deploy:cloudflare`：Cloudflare 部署路径

## 项目信息

- **GitHub**：https://github.com/XiChuan9/xichuan-blog
- **默认 Vercel 示例域名**：https://xichuan-blog.vercel.app
- **许可证**：MIT
