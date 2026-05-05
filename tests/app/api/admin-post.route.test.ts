import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPostBySlug: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  authenticateCookieRequest: vi.fn(),
  invalidatePublicContentCache: vi.fn(),
  enqueueBackgroundJob: vi.fn(),
  getRouteContextWithDb: vi.fn(),
  parseJsonBody: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  deletePost: mocks.deletePost,
  getPostBySlug: mocks.getPostBySlug,
  updatePost: mocks.updatePost,
}))

vi.mock('@/lib/admin-auth', () => ({
  authenticateCookieRequest: mocks.authenticateCookieRequest,
}))

vi.mock('@/lib/cache', () => ({
  invalidatePublicContentCache: mocks.invalidatePublicContentCache,
}))

vi.mock('@/lib/background-jobs', () => ({
  enqueueBackgroundJob: mocks.enqueueBackgroundJob,
}))

vi.mock('@/lib/server/route-helpers', () => ({
  getRouteContextWithDb: mocks.getRouteContextWithDb,
  jsonError: (message: string, status = 500) => Response.json({ error: message }, { status }),
  jsonOk: (data: unknown, status = 200) => Response.json(data, { status }),
  parseJsonBody: mocks.parseJsonBody,
}))

import { PUT } from '@/app/api/admin/posts/[slug]/route'

describe('/api/admin/posts/[slug] route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticateCookieRequest.mockResolvedValue(true)
    mocks.getRouteContextWithDb.mockResolvedValue({
      ok: true,
      env: { CACHE: {} },
      db: { kind: 'db' },
      ctx: { waitUntil: vi.fn() },
    })
    mocks.getPostBySlug.mockResolvedValue({ id: 7, slug: 'old-slug' })
    mocks.parseJsonBody.mockResolvedValue({
      slug: 'next_slug',
      title: '文章标题',
      content: '更新后的正文',
      html: '<p>更新后的正文</p>',
      description: '   ',
      tags: ['AI', '写作'],
      cover_image: '/covers/admin.webp',
    })
    mocks.invalidatePublicContentCache.mockRejectedValue(new Error('cache down'))
    mocks.enqueueBackgroundJob.mockResolvedValue(undefined)
  })

  it('updates a post, falls back description, and tolerates cache invalidation failures', async () => {
    const request = {
      cookies: {
        get: vi.fn(() => ({ value: 'token' })),
      },
    } as never

    const response = await PUT(request, {
      params: Promise.resolve({ slug: 'old-slug' }),
    })
    const body = await response.json()

    expect(mocks.updatePost).toHaveBeenCalledWith(
      { kind: 'db' },
      7,
      expect.objectContaining({
        slug: 'next_slug',
        title: '文章标题',
        content: '更新后的正文',
        description: '更新后的正文',
        tags: ['AI', '写作'],
        cover_image: '/covers/admin.webp',
      }),
    )
    expect(mocks.enqueueBackgroundJob).toHaveBeenCalledTimes(1)
    expect(body).toEqual({ success: true, slug: 'next_slug' })
  })

  it('sanitizes stored article HTML on admin updates', async () => {
    mocks.parseJsonBody.mockResolvedValue({
      slug: 'old-slug',
      title: '文章标题',
      content: '更新后的正文',
      html: '<p onclick="alert(1)">正文</p><img src="/api/images/image/a.webp" onerror="alert(1)"><script>alert(1)</script>',
      description: '摘要',
    })

    const response = await PUT({ method: 'PUT', headers: new Headers() } as never, {
      params: Promise.resolve({ slug: 'old-slug' }),
    })

    expect(response.status).toBe(200)
    const saved = mocks.updatePost.mock.calls[0][2]
    expect(saved.html).toContain('<p>正文</p>')
    expect(saved.html).toContain('src="/api/images/image/a.webp"')
    expect(saved.html).not.toContain('onclick')
    expect(saved.html).not.toContain('onerror')
    expect(saved.html).not.toContain('<script')
  })
})
