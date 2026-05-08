# XiChuan Blog

[English README](README.en.md) · [中文 README](README.md)

[![CI](https://github.com/XiChuan9/xichuan-blog/actions/workflows/verify.yml/badge.svg)](https://github.com/XiChuan9/xichuan-blog/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/XiChuan9/xichuan-blog)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/XiChuan9/xichuan-blog)
[![Use this template](https://img.shields.io/badge/GitHub-Use%20this%20template-111111?logo=github)](https://github.com/XiChuan9/xichuan-blog/generate)

XiChuan Blog is an open-source Next.js blog system for writers who want to own their publishing workflow instead of depending entirely on platform algorithms.

It is more than a static Markdown template: it includes a reader-facing blog, an admin dashboard, a rich editor, AI writing actions, AI image generation, themes, search, API tokens, and external publishing integrations.

- Demo: <https://xichuan-blog.vercel.app/>
- Intro article: <https://xichuan-blog.vercel.app/xichuan-blog>
- Repository: <https://github.com/XiChuan9/xichuan-blog>

## Features

- Reader and admin editing flows with a Notion-like writing experience
- Four homepage themes with responsive layouts
- Bubble menu and Ask AI actions for rewriting, polishing, expanding, and translating selected text
- AI-generated summaries, tags, SEO slugs, and cover images
- Configurable text and image model providers
- Image workflows for upload, crop, cover selection, alignment, and reference-based generation
- Public, draft, password-protected, and unlisted publishing states
- API tokens for external publishing tools
- Cloudflare Workers + D1 + R2 deployment, or Vercel + Turso + Blob deployment

## Screenshots

### Homepage Themes

![Homepage themes](docs/screenshots/home-themes.webp)

### Editor

![Editor overview](docs/screenshots/editor-overview.webp)

### Ask AI

![Ask AI](docs/screenshots/ask-ai.png)

### Admin Settings

![Admin settings](docs/screenshots/admin-settings.webp)

## Ecosystem

The repository also includes optional publishing tools:

- [`ecosystem/chrome-clipper`](ecosystem/chrome-clipper/README.md): save web pages into blog drafts from the browser
- [`ecosystem/obsidian-publisher`](ecosystem/obsidian-publisher/README.md): publish from Obsidian
- [`ecosystem/xichuan-blog-publish-skill`](ecosystem/xichuan-blog-publish-skill/README.md): publish through a command or Claude Skill workflow
- [`ecosystem/README.md`](ecosystem/README.md): ecosystem overview

## Quick Start

```bash
git clone https://github.com/XiChuan9/xichuan-blog.git
cd xichuan-blog
npm install
cp .env.example .env.local
npm run password:hash -- "your-admin-password"
npm run dev
```

Put the generated password hash into `ADMIN_PASSWORD_HASH` in `.env.local`.

Common routes:

- Home: `/`
- Admin: `/admin`
- Editor: `/editor`

## Deploy

See [DEPLOY.en.md](DEPLOY.en.md) for full Vercel and Cloudflare instructions.

Required environment variables:

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com
ADMIN_PASSWORD_HASH=pbkdf2-sha256$...
ADMIN_TOKEN_SALT=change-me-to-a-random-string
AI_CONFIG_ENCRYPTION_SECRET=change-me-to-another-random-string
```

For Vercel, also configure Turso and Blob:

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
NEXT_PUBLIC_VERCEL_BLOB_ACCESS=public
```

For Cloudflare, initialize resources with:

```bash
npm run cf:init -- --site-url=https://your-domain.com
npm run deploy:cloudflare
```

## Stack

- Next.js 16
- React 19
- TypeScript
- Turso / libSQL
- Vercel Blob
- OpenNext for Cloudflare
- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- Novel / Tiptap

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start local Next.js development |
| `npm run build` | Build the app |
| `npm run build:vercel` | Build for Vercel runtime |
| `npm run verify:quick` | Run lint, tests, and build |
| `npm run verify:vercel` | Run lint, tests, and Vercel build |
| `npm run verify` | Run the full verification chain |
| `npm run password:hash` | Generate an admin password hash |
| `npm run secret:scan` | Scan for common secret patterns |
| `npm run cf:init` | Initialize Cloudflare resources and defaults |
| `npm run preview` | Preview the Worker runtime |
| `npm run deploy:cloudflare` | Deploy to Cloudflare Workers |

## Security

Admin passwords are stored as PBKDF2 hashes. Article access codes are hashed before they are stored. API tokens are stored hashed and shown only once at creation time.

Custom site scripts are restricted to HTTPS external scripts from trusted analytics hosts. Inline JavaScript and arbitrary HTML are ignored.

## Contributing

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)

## License

MIT
