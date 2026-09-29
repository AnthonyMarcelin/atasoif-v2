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

/**
 * SPA landing after Ally OAuth: stores the Bearer token client-side.
 * Token goes in the URL fragment (not the query) so proxies / Referer / access logs
 * do not capture the Bearer secret. The SPA must read `location.hash` then strip it.
 */
export function buildFrontendOAuthRedirect(accessToken: string): string {
  const base = env.get('FRONTEND_URL').replace(/\/$/, '')
  const url = new URL(`${base}/auth/oauth/callback`)
  url.hash = new URLSearchParams({ token: accessToken }).toString()
  return url.toString()
}

/**
 * SPA login with a short OAuth error code (no secrets).
 */
export function buildFrontendLoginErrorRedirect(code: string): string {
  const base = env.get('FRONTEND_URL').replace(/\/$/, '')
  const url = new URL(`${base}/auth/login`)
  url.searchParams.set('oauthError', code)
  return url.toString()
}
