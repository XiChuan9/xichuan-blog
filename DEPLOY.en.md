# Deployment Guide

[English deployment guide](DEPLOY.en.md) · [中文部署指南](DEPLOY.md)

XiChuan Blog supports two deployment paths:

- `Vercel + Turso/libSQL + Vercel Blob`
- `OpenNext + Cloudflare Workers + D1 + R2`

Vercel is the recommended path for most free-plan deployments because it avoids Worker bundle-size limits. The Cloudflare path is available when you want native D1, R2, Workers, and optional Cloudflare platform features.

## Generate Admin Password Hash

Admin login requires a hashed password:

```bash
npm run password:hash -- "your-admin-password"
```

Use the output as `ADMIN_PASSWORD_HASH`.

## Vercel

### 1. Create Storage

Create a Turso database:

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

Create a Vercel Blob store:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
NEXT_PUBLIC_VERCEL_BLOB_ACCESS=public
```

Public Blob storage is recommended for blog media. Set `NEXT_PUBLIC_VERCEL_BLOB_ACCESS=private` only if you explicitly need private media.

### 2. Set Environment Variables

Minimum Vercel variables:

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

Optional external AI provider:

```env
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Optional Workers AI compatibility through Cloudflare REST credentials:

```env
ENABLE_WORKERS_AI=1
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
WORKERS_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
```

### 3. Verify Locally

```bash
npm install
cp .env.example .env.local
npm run verify:vercel
```

### 4. Deploy

Import the repository into Vercel and choose the Next.js framework preset.

The repository includes `vercel.json`:

- `buildCommand`: `npm run build:vercel`
- `installCommand`: `npm install`

The base schema is initialized automatically on first request.

## Cloudflare

### 1. Install and Configure

```bash
npm install
cp .env.example .env.local
```

Minimum local values:

```env
ADMIN_PASSWORD_HASH=pbkdf2-sha256$...
ADMIN_TOKEN_SALT=change-me-to-a-random-string
AI_CONFIG_ENCRYPTION_SECRET=change-me-to-another-random-string
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2. Login

```bash
npx wrangler login
```

### 3. Initialize Resources

```bash
npm run cf:init -- --site-url=https://your-domain.com
```

Optional public cache KV:

```bash
npm run cf:init -- --site-url=https://your-domain.com --with-kv
```

This generates `wrangler.local.toml` with real D1, R2, and optional KV bindings.

### 4. Set Secrets

```bash
npm run password:hash -- "your-admin-password"
npx wrangler secret put ADMIN_PASSWORD_HASH -c wrangler.local.toml
npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
npx wrangler secret put AI_CONFIG_ENCRYPTION_SECRET -c wrangler.local.toml
```

Optional AI secret:

```bash
npx wrangler secret put AI_API_KEY -c wrangler.local.toml
```

### 5. Deploy

```bash
npm run cf-typegen
npm run deploy:cloudflare
```

## Local Worker Preview

```bash
npm run preview
```

The preview script prefers `wrangler.local.toml`. The template `wrangler.toml` intentionally does not contain production resource bindings.

## Updating

```bash
git pull
npm install
npm run verify
npm run deploy:cloudflare
```

## Troubleshooting

### Missing D1 or R2 during deploy

Run:

```bash
npm run cf:init -- --site-url=https://your-domain.com
```

### Admin login says auth is not configured

Set:

```bash
npx wrangler secret put ADMIN_PASSWORD_HASH -c wrangler.local.toml
npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
```

### Saved AI keys cannot be decrypted

`AI_CONFIG_ENCRYPTION_SECRET` or `ADMIN_TOKEN_SALT` was likely changed. Keep `AI_CONFIG_ENCRYPTION_SECRET` stable and do not reuse it as the token salt.

### RSS, sitemap, or canonical URLs point to the wrong domain

Check both `.env.local` and `wrangler.local.toml`. `NEXT_PUBLIC_SITE_URL` must match your public domain.
