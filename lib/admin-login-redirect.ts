const DEFAULT_ADMIN_REDIRECT = '/admin'

export function resolveAdminLoginRedirectPath(
  redirectTo: string | null | undefined,
  origin: string,
) {
  if (
    !redirectTo ||
    !redirectTo.startsWith('/') ||
    redirectTo.startsWith('//') ||
    redirectTo.includes('\\')
  ) {
    return DEFAULT_ADMIN_REDIRECT
  }

  try {
    const base = new URL(origin)
    const target = new URL(redirectTo, base)

    if (target.origin !== base.origin) {
      return DEFAULT_ADMIN_REDIRECT
    }

    return `${target.pathname}${target.search}${target.hash}` || DEFAULT_ADMIN_REDIRECT
  } catch {
    return DEFAULT_ADMIN_REDIRECT
  }
}
