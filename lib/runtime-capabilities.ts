export interface RuntimeCapabilities {
  platform: 'cloudflare' | 'vercel' | 'unknown'
  bindings: {
    d1: boolean
    cache: boolean
    images: boolean
    queue: boolean
    workersAI: boolean
    vectorize: boolean
  }
  features: {
    asyncJobs: {
      enabled: boolean
      strategy: 'queue' | 'inline'
      note: string
    }
    aiInference: {
      enabled: boolean
      strategy: 'workers-ai' | 'external-provider' | 'disabled'
      note: string
    }
    mediaPipeline: {
      enabled: boolean
      strategy: 'cloudflare' | 'vercel-blob' | 'origin'
      note: string
    }
    relatedContent: {
      enabled: boolean
      strategy: 'vectorize' | 'fts'
      note: string
    }
  }
}

function readFlag(value: unknown): boolean {
  return typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function detectRuntimeCapabilities(env?: Partial<CloudflareEnv> | null): RuntimeCapabilities {
  const platform = env?.RUNTIME_TARGET === 'vercel'
    ? 'vercel'
    : env?.RUNTIME_TARGET === 'cloudflare'
      ? 'cloudflare'
      : 'unknown'
  const bindings = {
    d1: Boolean(env?.DB),
    cache: Boolean(env?.CACHE),
    images: Boolean(env?.IMAGES),
    queue: Boolean(env?.BACKGROUND_QUEUE),
    workersAI: Boolean(env?.WORKERS_AI),
    vectorize: Boolean(env?.VECTOR_INDEX),
  }

  const asyncJobsEnabled = bindings.queue && readFlag(env?.ENABLE_BACKGROUND_JOBS)
  const workersAIEnabled = bindings.workersAI && readFlag(env?.ENABLE_WORKERS_AI)
  const vectorizeEnabled = bindings.vectorize && readFlag(env?.ENABLE_VECTOR_SEARCH)
  const cloudflareMediaEnabled = platform === 'cloudflare' && bindings.images && readFlag(env?.ENABLE_CF_IMAGE_PIPELINE)
  const vercelBlobEnabled = platform === 'vercel' && bindings.images

  return {
    platform,
    bindings,
    features: {
      asyncJobs: {
        enabled: asyncJobsEnabled,
        strategy: asyncJobsEnabled ? 'queue' : 'inline',
        note: asyncJobsEnabled
          ? '优先使用 Cloudflare Queues，失败时回退到 waitUntil / inline。'
          : platform === 'vercel'
            ? 'Vercel 下使用非阻塞 Promise 回退，功能保持请求内或后台延迟执行。'
            : '回退到 waitUntil 或请求内执行，不依赖付费资源。',
      },
      aiInference: {
        enabled: workersAIEnabled || Boolean(env?.AI_API_KEY),
        strategy: workersAIEnabled
          ? 'workers-ai'
          : env?.AI_API_KEY
            ? 'external-provider'
            : 'disabled',
        note: workersAIEnabled
          ? platform === 'vercel'
            ? '通过 Cloudflare Workers AI REST API 保留 Workers AI 通道。'
            : '优先走 Workers AI。'
          : env?.AI_API_KEY
            ? '回退到外部 OpenAI 兼容服务商。'
            : '未配置 AI，相关增强保持可选关闭。',
      },
      mediaPipeline: {
        enabled: true,
        strategy: cloudflareMediaEnabled
          ? 'cloudflare'
          : vercelBlobEnabled
            ? 'vercel-blob'
            : 'origin',
        note: cloudflareMediaEnabled
          ? '启用 Cloudflare 图片派生/压缩链。'
          : vercelBlobEnabled
            ? '使用 Vercel Blob 存储和 /api/images 统一分发，图片优化保持浏览器侧压缩。'
            : '默认使用浏览器侧压缩，原图链路仍可用。',
      },
      relatedContent: {
        enabled: true,
        strategy: vectorizeEnabled ? 'vectorize' : 'fts',
        note: vectorizeEnabled
          ? '使用 Vectorize 做语义召回。'
          : '回退到 D1/FTS 与规则召回，不阻塞开源部署。',
      },
    },
  }
}
