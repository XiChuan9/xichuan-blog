import {
  getVercelRuntimeContext,
  isVercelRuntimeConfigured,
  type AppRuntimeContext,
} from '@/lib/runtime/vercel'

export async function getAppCloudflareContext() {
  if (
    process.env.VERCEL === '1' ||
    process.env.QMBLOG_RUNTIME === 'vercel' ||
    (
      process.env.NEXT_PHASE === 'phase-production-build' &&
      process.env.QMBLOG_RUNTIME !== 'cloudflare'
    )
  ) {
    return getVercelRuntimeContext()
  }

  if (!isVercelRuntimeConfigured()) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const context = await getCloudflareContext({ async: true })
      const env = context.env as CloudflareEnv
      env.RUNTIME_TARGET = 'cloudflare'
      return {
        env,
        ctx: context.ctx,
        runtime: 'cloudflare',
      } as AppRuntimeContext
    } catch {
      return getVercelRuntimeContext()
    }
  }

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const context = await getCloudflareContext({ async: true })
    if (context?.env?.DB || context?.env?.IMAGES) {
      const env = context.env as CloudflareEnv
      env.RUNTIME_TARGET = 'cloudflare'
      return {
        env,
        ctx: context.ctx,
        runtime: 'cloudflare',
      } as AppRuntimeContext
    }
  } catch {
    // Vercel and ordinary Next.js runtimes do not provide OpenNext's Cloudflare context.
  }

  return getVercelRuntimeContext()
}

export async function getAppCloudflareEnv() {
  return (await getAppCloudflareContext()).env
}
