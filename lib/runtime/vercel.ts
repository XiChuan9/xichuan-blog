import { createTursoD1Database, resolveTursoConfigFromEnv } from '@/lib/runtime/turso-d1'
import { createVercelBlobBucket, hasVercelBlobConfig } from '@/lib/runtime/vercel-blob'
import { createWorkersAiRestBinding } from '@/lib/runtime/workers-ai-rest'

export interface AppRuntimeContext {
  env: CloudflareEnv
  ctx: {
    waitUntil: (promise: Promise<unknown>) => void
  }
  runtime: 'cloudflare' | 'vercel'
}

function getProcessEnvValue(key: keyof CloudflareEnv): string | undefined {
  return process.env[key as string]
}

function createNoopExecutionContext() {
  return {
    waitUntil(promise: Promise<unknown>) {
      void promise.catch((error) => {
        console.error('Background task failed:', error)
      })
    },
  }
}

export function isVercelRuntimeConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.XICHUAN_BLOG_RUNTIME === 'vercel' ||
    resolveTursoConfigFromEnv(env) ||
    hasVercelBlobConfig(env) ||
    env.VERCEL === '1',
  )
}

export async function getVercelRuntimeContext(): Promise<AppRuntimeContext> {
  const turso = resolveTursoConfigFromEnv()
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim()

  const runtimeEnv: CloudflareEnv = {
    DB: turso ? createTursoD1Database(turso) : undefined,
    IMAGES: hasVercelBlobConfig() ? createVercelBlobBucket() : undefined,
    WORKERS_AI: accountId && apiToken ? createWorkersAiRestBinding({ accountId, apiToken }) : undefined,
    ADMIN_PASSWORD: getProcessEnvValue('ADMIN_PASSWORD'),
    ADMIN_TOKEN_SALT: getProcessEnvValue('ADMIN_TOKEN_SALT'),
    AI_CONFIG_ENCRYPTION_SECRET: getProcessEnvValue('AI_CONFIG_ENCRYPTION_SECRET'),
    NEXT_PUBLIC_SITE_URL: getProcessEnvValue('NEXT_PUBLIC_SITE_URL'),
    AI_API_KEY: getProcessEnvValue('AI_API_KEY'),
    AI_BASE_URL: getProcessEnvValue('AI_BASE_URL'),
    AI_MODEL: getProcessEnvValue('AI_MODEL'),
    WORKERS_AI_MODEL: getProcessEnvValue('WORKERS_AI_MODEL'),
    CLOUDFLARE_ACCOUNT_ID: getProcessEnvValue('CLOUDFLARE_ACCOUNT_ID'),
    CLOUDFLARE_API_TOKEN: getProcessEnvValue('CLOUDFLARE_API_TOKEN'),
    ENABLE_BACKGROUND_JOBS: getProcessEnvValue('ENABLE_BACKGROUND_JOBS'),
    ENABLE_WORKERS_AI: getProcessEnvValue('ENABLE_WORKERS_AI'),
    ENABLE_VECTOR_SEARCH: getProcessEnvValue('ENABLE_VECTOR_SEARCH'),
    ENABLE_CF_IMAGE_PIPELINE: getProcessEnvValue('ENABLE_CF_IMAGE_PIPELINE'),
    ENABLE_PUBLIC_CACHE_IN_DEV: getProcessEnvValue('ENABLE_PUBLIC_CACHE_IN_DEV'),
    RUNTIME_TARGET: 'vercel',
  }

  return {
    env: runtimeEnv,
    ctx: createNoopExecutionContext(),
    runtime: 'vercel',
  }
}
