import { deletePost, getPostBySlug, updatePost } from '@/lib/db'
import { authenticateCookieRequest } from '@/lib/admin-auth'
import { invalidatePublicContentCache } from '@/lib/cache'
import { buildAutoDescription, normalizePostSlug } from '@/lib/post-utils'
import { enqueueBackgroundJob } from '@/lib/background-jobs'
import { sanitizeArticleHtml } from '@/lib/html-sanitize'
import { getRouteContextWithDb, jsonError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'
import type { NextRequest } from 'next/server'

async function checkAuth(req: NextRequest, db: D1Database): Promise<boolean> {
  return authenticateCookieRequest(req, db)
}

type Ctx = { params: Promise<{ slug: string }> }

// 获取单篇文章（编辑用）
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params
  const route = await getRouteContextWithDb('DB not configured')
  if (!route.ok) return route.response
  if (!(await checkAuth(req, route.db))) {
    return jsonError('Unauthorized', 401)
  }

  const post = await getPostBySlug(route.db, slug)
  if (!post) return jsonError('文章不存在', 404)

  return jsonOk(post)
}

// 更新文章
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { slug } = await params
  const route = await getRouteContextWithDb('DB not configured')
  if (!route.ok) return route.response
  const { env, db, ctx } = route
  if (!(await checkAuth(req, db))) {
    return jsonError('Unauthorized', 401)
  }

  const post = await getPostBySlug(db, slug)
  if (!post) return jsonError('文章不存在', 404)

  try {
    const {
      slug: nextSlugRaw,
      title,
      content,
      html,
      category,
      status,
      password,
      is_pinned,
      is_hidden,
      cover_image,
      tags,
      description,
    } = await parseJsonBody<{
      slug?: string
      title?: string
      content?: string
      html?: string
      category?: string
      status?: 'draft' | 'published' | 'deleted'
      password?: string | null
      is_pinned?: number
      is_hidden?: number
      cover_image?: string | null
      tags?: string[]
      description?: string
    }>(req)
    const nextSlug = typeof nextSlugRaw === 'string' ? normalizePostSlug(nextSlugRaw) : ''
    const normalizedDescription = typeof description === 'string' && description.trim()
      ? description.trim()
      : buildAutoDescription(typeof content === 'string' ? content : '')

    await updatePost(db, post.id, {
      slug: nextSlug || undefined,
      title,
      content,
      html: typeof html === 'string' ? sanitizeArticleHtml(html) : html,
      category,
      status,
      password,
      is_pinned,
      is_hidden,
      cover_image,
      tags,
      description: normalizedDescription,
    })

    // 清除 KV 缓存（失败不影响保存结果）
    try {
      await invalidatePublicContentCache(env)
    } catch (cacheErr) {
      console.warn('Cache invalidation failed:', cacheErr)
    }

    await enqueueBackgroundJob(
      env,
      {
        type: 'sync-post-related-index',
        postId: post.id,
      },
      {
        waitUntil: ctx?.waitUntil?.bind(ctx),
      },
    )

    return jsonOk({ success: true, slug: nextSlug || slug })
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed: posts\.slug/i.test(err.message)) {
      return jsonError('slug 已存在，请换一个', 409)
    }
    console.error('PUT /api/admin/posts/[slug] error:', err)
    return jsonError(err instanceof Error ? err.message : '保存失败', 500)
  }
}

// 删除文章
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { slug } = await params
  const route = await getRouteContextWithDb('DB not configured')
  if (!route.ok) return route.response
  const { env, db, ctx } = route
  if (!(await checkAuth(req, db))) {
    return jsonError('Unauthorized', 401)
  }

  try {
    const post = await getPostBySlug(db, slug)
    if (!post) {
      return jsonError('文章不存在', 404)
    }

    await deletePost(db, slug)

    // 清除 KV 缓存（失败不影响删除结果）
    try {
      await invalidatePublicContentCache(env)
    } catch (cacheErr) {
      console.warn('Cache invalidation failed:', cacheErr)
    }

    await enqueueBackgroundJob(
      env,
      {
        type: 'delete-post-related-index',
        postId: post.id,
      },
      {
        waitUntil: ctx?.waitUntil?.bind(ctx),
      },
    )

    return jsonOk({ success: true })
  } catch (error) {
    console.error('Delete post failed:', error)
    return jsonOk(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除失败，请重试',
      },
      500,
    )
  }
}
