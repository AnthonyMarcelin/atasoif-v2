import env from '#start/env'

export type OAuthReturnClient = 'web' | 'native'

const OAUTH_CALLBACK_PATH = '/auth/oauth/callback'
const OAUTH_LOGIN_PATH = '/auth/login'
const DEFAULT_NATIVE_OAUTH_RETURN = 'fr.atasoif.app://auth/oauth/callback'

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
 * Base URL for Capacitor OAuth return (custom scheme).
 * Dokploy: NATIVE_OAUTH_RETURN_URL=fr.atasoif.app://auth/oauth/callback
 */
export function nativeOAuthReturnBase(): string {
  const configured = env.get('NATIVE_OAUTH_RETURN_URL')?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }
  return DEFAULT_NATIVE_OAUTH_RETURN
}

function oauthReturnBase(client: OAuthReturnClient): string {
  if (client === 'native') {
    return nativeOAuthReturnBase()
  }
  return env.get('FRONTEND_URL').replace(/\/$/, '')
}

/**
 * Build an absolute return URL for http(s) origins or custom URL schemes.
 * `new URL(path, 'fr.atasoif.app://…')` is not reliable across runtimes.
 */
function withPath(base: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (/^https?:\/\//i.test(base)) {
    return new URL(normalizedPath, `${base}/`).toString()
  }

  const root = base.replace(/\/$/, '')
  // NATIVE_OAUTH_RETURN_URL may already be the full callback URL.
  if (normalizedPath === OAUTH_CALLBACK_PATH) {
    return root.includes('/auth/') ? root : `${root}${normalizedPath}`
  }
  if (normalizedPath === OAUTH_LOGIN_PATH) {
    if (root.includes('/auth/oauth/callback')) {
      return root.replace(/\/auth\/oauth\/callback\/?$/, OAUTH_LOGIN_PATH)
    }
    return `${root}${OAUTH_LOGIN_PATH}`
  }
  return `${root}${normalizedPath}`
}

/**
 * SPA / Capacitor landing after Ally OAuth: stores the Bearer token client-side.
 * Token goes in the URL fragment (not the query) so proxies / Referer / access logs
 * do not capture the Bearer secret. The client must read `location.hash` then strip it.
 */
export function buildFrontendOAuthRedirect(
  accessToken: string,
  client: OAuthReturnClient = 'web'
): string {
  const url = withPath(oauthReturnBase(client), OAUTH_CALLBACK_PATH)
  const hash = new URLSearchParams({ token: accessToken }).toString()
  return `${url}#${hash}`
}

/**
 * Login with a short OAuth error code (no secrets).
 */
export function buildFrontendLoginErrorRedirect(
  code: string,
  client: OAuthReturnClient = 'web'
): string {
  const base = withPath(oauthReturnBase(client), OAUTH_LOGIN_PATH)
  if (/^https?:\/\//i.test(base)) {
    const url = new URL(base)
    url.searchParams.set('oauthError', code)
    return url.toString()
  }
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}oauthError=${encodeURIComponent(code)}`
}

/**
 * Public invite / share link origin (marketing site). Independent from FRONTEND_URL
 * so Capacitor OAuth / mail deep links can point elsewhere later.
 */
export function shareLinkOrigin(): string {
  const configured = env.get('SHARE_LINK_ORIGIN')?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }
  return 'https://atasoif.fr'
}

export function buildShareInviteUrl(inviteCode: string): string {
  return `${shareLinkOrigin()}/i/${inviteCode}`
}
