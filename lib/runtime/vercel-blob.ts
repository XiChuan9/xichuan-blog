import { resolveBlobAccess } from '@/lib/runtime/blob-access'

type R2PutValue = File | ArrayBuffer | ArrayBufferView | ReadableStream

interface VercelBlobMetadata {
  etag?: string
  size?: number | null
  contentType?: string | null
  contentDisposition?: string | null
  cacheControl?: string | null
}

interface VercelBlobGetResult {
  statusCode?: number
  stream?: ReadableStream<Uint8Array> | null
  headers?: Headers
  response?: { headers?: Headers }
  blob?: VercelBlobMetadata
  etag?: string
  size?: number | null
  contentType?: string | null
  contentDisposition?: string | null
  cacheControl?: string | null
}

function normalizePutBody(value: R2PutValue): File | ArrayBuffer | ReadableStream {
  if (ArrayBuffer.isView(value)) {
    const copy = new Uint8Array(value.byteLength)
    copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    return copy.buffer
  }
  return value
}

function getRangeHeader(range?: { offset: number; length: number }) {
  if (!range) return undefined
  const end = Math.max(range.offset, range.offset + range.length - 1)
  return `bytes=${range.offset}-${end}`
}

export function hasVercelBlobConfig(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.BLOB_READ_WRITE_TOKEN || env.VERCEL_BLOB_READ_WRITE_TOKEN)
}

export function createVercelBlobBucket(env: NodeJS.ProcessEnv = process.env): R2Bucket {
  const access = resolveBlobAccess(env.VERCEL_BLOB_ACCESS || env.NEXT_PUBLIC_VERCEL_BLOB_ACCESS)
  const token = env.BLOB_READ_WRITE_TOKEN || env.VERCEL_BLOB_READ_WRITE_TOKEN

  return {
    async put(key, value, options) {
      const { put } = await import('@vercel/blob')
      await put(key, normalizePutBody(value as R2PutValue), {
        access,
        token,
        allowOverwrite: true,
        multipart: true,
        contentType: options?.httpMetadata?.contentType,
        cacheControlMaxAge: 31536000,
      })
    },

    async get(key, options) {
      const { get } = await import('@vercel/blob')
      const range = getRangeHeader(options?.range)
      const result = await get(key, {
        access,
        token,
        headers: range ? { Range: range } : undefined,
      })

      if (!result) return null
      const normalizedResult = result as unknown as VercelBlobGetResult
      const statusCode = Number(normalizedResult.statusCode ?? 200)
      if (statusCode !== 200 && statusCode !== 206) return null
      if (!normalizedResult.stream) return null

      const blob = normalizedResult.blob ?? normalizedResult
      const responseHeaders = normalizedResult.headers ?? normalizedResult.response?.headers

      return {
        body: normalizedResult.stream,
        httpEtag: blob.etag ?? '',
        size: blob.size ?? 0,
        writeHttpMetadata(headers: Headers) {
          if (blob.contentType) headers.set('Content-Type', blob.contentType)
          if (blob.contentDisposition) headers.set('Content-Disposition', blob.contentDisposition)
          if (blob.cacheControl) headers.set('Cache-Control', blob.cacheControl)
          const contentRange = responseHeaders?.get('content-range')
          const contentLength = responseHeaders?.get('content-length')
          if (contentRange) headers.set('Content-Range', contentRange)
          if (contentLength) headers.set('Content-Length', contentLength)
        },
      }
    },

    async head(key) {
      const { head } = await import('@vercel/blob')
      try {
        const result = await head(key, { token })
        return {
          size: result.size,
          httpMetadata: {
            contentType: result.contentType,
          },
        }
      } catch {
        return null
      }
    },
  }
}
