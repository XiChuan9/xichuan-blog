import { NextRequest, NextResponse } from 'next/server'
import type { HandleUploadBody } from '@vercel/blob/client'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { authenticateRequest } from '@/lib/admin-auth'

const MAX_FILE_SIZE = 100 * 1024 * 1024

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
  'audio/mp4',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-rar',
  'application/x-7z-compressed',
  'application/epub+zip',
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook',
  'application/octet-stream',
  'text/plain',
]

function isSafeUploadPath(pathname: string) {
  return /^(image|audio|video|document)\/\d{4}\/\d{2}\/[a-z0-9._-]+$/i.test(pathname)
    && !pathname.toLowerCase().endsWith('.svg')
}

function isAllowedClientPayload(body: HandleUploadBody) {
  if (body.type !== 'blob.generate-client-token') return true

  const payload = body.payload.clientPayload
  if (!payload) return true

  try {
    const parsed = JSON.parse(payload) as { contentType?: string }
    return parsed.contentType?.trim().toLowerCase() !== 'image/svg+xml'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const env = await getAppCloudflareEnv()
  const isAuthenticated = await authenticateRequest(req, env?.DB)

  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Vercel Blob is not configured' }, { status: 400 })
  }

  try {
    const body = await req.json() as HandleUploadBody
    if (!isAllowedClientPayload(body)) {
      return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 })
    }

    const { handleUpload } = await import('@vercel/blob/client')
    const result = await handleUpload({
      body,
      request: req,
      token: process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        if (!isSafeUploadPath(pathname)) {
          throw new Error('Invalid upload path')
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 31536000,
        }
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Blob upload token failed' },
      { status: 400 },
    )
  }
}
