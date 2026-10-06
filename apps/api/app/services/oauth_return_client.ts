import type { HttpContext } from '@adonisjs/core/http'
import type { OAuthReturnClient } from '#services/frontend_url'

const SESSION_KEY = 'oauth_return_client'
const COOKIE_KEY = 'oauth_return_client'

/**
 * Remember whether Ally should hand the Bearer back to Capacitor (custom scheme)
 * or to the web FRONTEND_URL. Set on `/redirect?client=native`, read on `/callback`.
 *
 * Apple uses `response_mode=form_post` (cross-site POST). We mirror the flag in an
 * encrypted cookie with SameSite=None in production so the callback still sees it.
 */
export function rememberOAuthReturnClient(ctx: HttpContext): void {
  const raw = ctx.request.input('client')
  if (raw === 'native') {
    ctx.session.put(SESSION_KEY, 'native')
    ctx.response.encryptedCookie(COOKIE_KEY, 'native', {
      maxAge: '15m',
      httpOnly: true,
      // Cross-site Apple form_post needs None+Secure in production.
      sameSite: ctx.request.secure() || ctx.request.header('x-forwarded-proto') === 'https' ? 'none' : 'lax',
      secure: ctx.request.secure() || ctx.request.header('x-forwarded-proto') === 'https',
      path: '/',
    })
    return
  }
  ctx.session.forget(SESSION_KEY)
  ctx.response.clearCookie(COOKIE_KEY)
}

export function consumeOAuthReturnClient(ctx: HttpContext): OAuthReturnClient {
  const fromSession = ctx.session.pull(SESSION_KEY)
  const fromCookie = ctx.request.encryptedCookie(COOKIE_KEY)
  ctx.response.clearCookie(COOKIE_KEY)
  if (fromSession === 'native' || fromCookie === 'native') {
    return 'native'
  }
  return 'web'
}
