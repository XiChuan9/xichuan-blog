import type { EditorInstance } from 'novel'
import { resolveBlobAccess } from '@/lib/runtime/blob-access'

export interface UploadedEditorFile {
  url: string
  type: string
  name: string
}

const VERCEL_SERVER_UPLOAD_LIMIT = 4 * 1024 * 1024

function createClientUploadId() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 12)
}

function sanitizeFilenameSegment(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function getFilenameExtension(value: string) {
  const match = value.match(/\.([a-z0-9]{2,8})$/i)
  return match?.[0]?.toLowerCase() ?? ''
}

function isBlockedUploadFile(file: File) {
  return file.type.trim().toLowerCase() === 'image/svg+xml' || getFilenameExtension(file.name) === '.svg'
}

function getUploadCategory(file: File) {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  return 'document'
}

function sanitizeUploadFilename(filename: string) {
  const trimmed = filename.trim().toLowerCase()
  const safe = trimmed.replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-')
  return safe || 'file'
}

function buildClientUploadPath(file: File) {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${getUploadCategory(file)}/${yyyy}/${mm}/${createClientUploadId()}-${sanitizeUploadFilename(file.name)}`
}

function resolveUploadContentType(file: File) {
  if (file.type && file.type !== 'application/octet-stream') return file.type

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'mp4') return 'video/mp4'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'wav') return 'audio/wav'
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'zip') return 'application/zip'
  if (ext === 'rar') return 'application/x-rar-compressed'
  if (ext === '7z') return 'application/x-7z-compressed'
  if (ext === 'epub') return 'application/epub+zip'
  if (ext === 'mobi') return 'application/x-mobipocket-ebook'
  if (ext === 'azw' || ext === 'azw3') return 'application/vnd.amazon.ebook'
  if (ext === 'txt') return 'text/plain'
  return file.type || 'application/octet-stream'
}

function toAssetUrl(pathname: string) {
  return `/api/images/${pathname.split('/').map(encodeURIComponent).join('/')}`
}

async function uploadEditorFileViaVercelBlob(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedEditorFile> {
  const { upload } = await import('@vercel/blob/client')
  const result = await upload(buildClientUploadPath(file), file, {
    access: resolveBlobAccess(process.env.NEXT_PUBLIC_VERCEL_BLOB_ACCESS),
    handleUploadUrl: '/api/uploads/client',
    clientPayload: JSON.stringify({ contentType: resolveUploadContentType(file) }),
    multipart: true,
    contentType: resolveUploadContentType(file),
    onUploadProgress(event) {
      onProgress?.(Math.round(event.percentage))
    },
  })

  return {
    url: toAssetUrl(result.pathname),
    type: getUploadCategory(file),
    name: file.name,
  }
}

function normalizeEditorLinkUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return '#'
  if (trimmed.startsWith('/')) return trimmed

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '#'
  } catch {
    return '#'
  }
}

export function buildEditorImageFilename(imageUrl: string, fallbackName = 'image') {
  const urlSegment = imageUrl.split('/').pop()?.split('?')[0]?.split('#')[0] ?? ''
  const fallbackBase = fallbackName.replace(/\.[^.]+$/, '')
  const preferredBase = sanitizeFilenameSegment(fallbackBase) || sanitizeFilenameSegment(urlSegment.replace(/\.[^.]+$/, ''))
  const extension = getFilenameExtension(urlSegment) || '.webp'
  return `${preferredBase || 'image'}${extension}`
}

export function downloadEditorImage(imageUrl: string, fallbackName?: string) {
  if (typeof document === 'undefined') return

  const anchor = document.createElement('a')
  anchor.href = imageUrl
  anchor.download = buildEditorImageFilename(imageUrl, fallbackName)
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export async function copyEditorImage(imageUrl: string) {
  if (
    typeof navigator === 'undefined'
    || typeof window === 'undefined'
    || !navigator.clipboard?.write
    || typeof window.ClipboardItem === 'undefined'
  ) {
    throw new Error('当前浏览器不支持复制图片')
  }

  const response = await fetch(imageUrl, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`图片获取失败 (${response.status})`)
  }

  const blob = await response.blob()
  const mimeType = blob.type || 'image/png'

  await navigator.clipboard.write([
    new window.ClipboardItem({
      [mimeType]: blob,
    }),
  ])
}

export async function uploadEditorFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedEditorFile> {
  if (isBlockedUploadFile(file)) {
    throw new Error('不支持的文件类型')
  }

  if (file.size > VERCEL_SERVER_UPLOAD_LIMIT) {
    try {
      return await uploadEditorFileViaVercelBlob(file, onProgress)
    } catch {
      // Non-Vercel deployments keep using the existing authenticated multipart route.
    }
  }

  const formData = new FormData()
  formData.append('file', file)

  return new Promise<UploadedEditorFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.withCredentials = true
    xhr.timeout = 5 * 60 * 1000

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as {
            success?: boolean
            url?: string
            type?: string
            name?: string
            error?: string
          }

          if (result.success && typeof result.url === 'string') {
            resolve({
              url: result.url,
              type: result.type || file.type,
              name: result.name || file.name,
            })
            return
          }

          reject(new Error(result.error || '文件上传失败'))
        } catch {
          reject(new Error('解析响应失败'))
        }
        return
      }

      if (xhr.status === 401) {
        reject(new Error('登录已过期，请刷新页面后重试'))
        return
      }

      if (xhr.status === 413) {
        reject(new Error('文件太大，最大支持 100MB'))
        return
      }

      reject(new Error(`上传失败 (${xhr.status})`))
    })

    xhr.addEventListener('error', () => {
      reject(new Error(`网络错误，文件可能太大（${(file.size / 1024 / 1024).toFixed(1)}MB）`))
    })
    xhr.addEventListener('timeout', () => reject(new Error('上传超时')))

    xhr.open('POST', '/api/uploads')
    xhr.send(formData)
  })
}

export function createUploadPlaceholderMarker() {
  return `⏳upload-${Date.now()}`
}

export function buildUploadPlaceholderText(file: File, marker: string) {
  if (file.type.startsWith('video/')) {
    return `📤 视频上传中... [${marker}]`
  }

  if (file.type.startsWith('audio/')) {
    return `📤 音频上传中... [${marker}]`
  }

  return `📤 ${file.name} 上传中... [${marker}]`
}

export function insertUploadPlaceholder(editor: EditorInstance, file: File, marker: string) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'paragraph',
      content: [{ type: 'text', text: buildUploadPlaceholderText(file, marker) }],
    })
    .run()
}

export function removeUploadPlaceholder(editor: EditorInstance, marker: string) {
  const { state } = editor
  const { doc } = state
  let placeholderPos: number | null = null
  let placeholderNodeSize = 0

  doc.descendants((node, pos) => {
    if (node.isBlock && node.textContent.includes(marker)) {
      placeholderPos = pos
      placeholderNodeSize = node.nodeSize
      return false
    }
  })

  if (placeholderPos === null) return false

  editor.view.dispatch(state.tr.delete(placeholderPos, placeholderPos + placeholderNodeSize))
  return true
}

export function insertUploadedFileIntoEditor(
  editor: EditorInstance,
  file: File,
  uploaded: UploadedEditorFile,
) {
  if (file.type.startsWith('video/')) {
    // @ts-expect-error - setVideo is defined in video-extension.tsx
    editor.chain().focus().setVideo({ src: uploaded.url }).run()
    return
  }

  if (file.type.startsWith('audio/')) {
    // @ts-expect-error - setAudio is defined in audio-extension.tsx
    editor.chain().focus().setAudio({ src: uploaded.url }).run()
    return
  }

  const hasLinkMark = Boolean(editor.state?.schema?.marks?.link)
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: `📎 ${file.name}`,
          marks: hasLinkMark
            ? [
                {
                  type: 'link',
                  attrs: {
                    href: normalizeEditorLinkUrl(uploaded.url),
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                  },
                },
              ]
            : undefined,
        },
      ],
    })
    .run()
}

export function insertGeneratedImageAtPosition(
  editor: EditorInstance,
  imageUrl: string,
  alt: string,
  insertPos: number | null,
) {
  const chain = editor.chain().focus()

  if (Number.isFinite(insertPos)) {
    chain.setTextSelection(Number(insertPos))
  }

  chain
    .insertContent([
      { type: 'image', attrs: { src: imageUrl, alt } },
      { type: 'paragraph' },
    ])
    .run()
}

export function insertGeneratedImageAfterNode(
  editor: EditorInstance,
  imageUrl: string,
  alt: string,
  nodePos: number | null,
) {
  if (!Number.isFinite(nodePos)) {
    insertGeneratedImageAtPosition(editor, imageUrl, alt, nodePos)
    return
  }

  const imageNode = editor.state.doc.nodeAt(Number(nodePos))
  const insertPos = imageNode ? Number(nodePos) + imageNode.nodeSize : Number(nodePos)
  insertGeneratedImageAtPosition(editor, imageUrl, alt, insertPos)
}

export function replaceImageNodeAtPosition(
  editor: EditorInstance,
  imageUrl: string,
  alt: string,
  nodePos: number | null,
) {
  if (!Number.isFinite(nodePos)) return false

  const pos = Number(nodePos)
  const node = editor.state.doc.nodeAt(pos)
  const imageType = editor.state.schema.nodes.image

  if (!node || node.type.name !== 'image' || !imageType) return false

  const nextNode = imageType.create({
    ...node.attrs,
    src: imageUrl,
    alt,
  })

  const transaction = editor.state.tr
    .replaceWith(pos, pos + node.nodeSize, nextNode)
    .scrollIntoView()

  editor.view.dispatch(transaction)
  return true
}
