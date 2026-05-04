export type BlobAccess = 'public' | 'private'

export function resolveBlobAccess(value?: string | null): BlobAccess {
  return value?.trim().toLowerCase() === 'private' ? 'private' : 'public'
}
