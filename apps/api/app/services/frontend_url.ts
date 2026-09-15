import env from '#start/env'

/**
 * Absolute frontend URL with an opaque token query param (deep link for mail CTAs).
 */
export function buildFrontendUrl(path: string, token: string): string {
  const base = env.get('FRONTEND_URL').replace(/\/$/, '')
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`)
  url.searchParams.set('token', token)
  return url.toString()
}
