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
 */
export function buildFrontendOAuthRedirect(accessToken: string): string {
  const base = env.get('FRONTEND_URL').replace(/\/$/, '')
  const url = new URL(`${base}/auth/oauth/callback`)
  url.searchParams.set('token', accessToken)
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
