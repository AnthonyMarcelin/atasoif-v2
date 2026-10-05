import { Oauth2Driver } from '@adonisjs/ally'
import type { HttpContext } from '@adonisjs/core/http'
import type {
  AllyUserContract,
  ApiRequestContract,
  LiteralStringUnion,
  Oauth2DriverConfig,
  RedirectRequestContract,
} from '@adonisjs/ally/types'
import type { Oauth2AccessToken } from '@adonisjs/ally/types'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { generateAppleClientSecret } from '#services/apple_client_secret'

export type AppleScopes = 'name' | 'email'

export type AppleAccessToken = Oauth2AccessToken & {
  idToken: string
  refreshToken?: string
}

export type AppleDriverConfig = Oauth2DriverConfig & {
  /** Services ID (web OAuth client_id), e.g. com.atasoif.web. */
  clientId: string
  /**
   * Unused at runtime when teamId/keyId/privateKey are set.
   * Kept for Oauth2DriverConfig compatibility / legacy static JWT.
   */
  clientSecret: string
  callbackUrl: string
  teamId: string
  keyId: string
  /** PEM of the Sign in with Apple .p8 key. */
  privateKey: string
  /** Optional iOS bundle id (native SIWA follow-up). */
  bundleId?: string
  scopes?: LiteralStringUnion<AppleScopes>[]
}

type AppleIdTokenClaims = JWTPayload & {
  email?: string
  email_verified?: boolean | 'true' | 'false'
  is_private_email?: boolean | 'true' | 'false'
}

type AppleFormUser = {
  email?: string
  name?: {
    firstName?: string
    lastName?: string
  }
}

const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'))

/**
 * Custom Ally driver for Sign in with Apple.
 * Generates a short-lived ES256 client_secret JWT before the token exchange
 * (no static 6-month secret in env).
 */
export class AppleDriver extends Oauth2Driver<AppleAccessToken, AppleScopes> {
  protected authorizeUrl = 'https://appleid.apple.com/auth/authorize'
  protected accessTokenUrl = 'https://appleid.apple.com/auth/token'
  protected codeParamName = 'code'
  protected errorParamName = 'error'
  protected stateCookieName = 'apple_oauth_state'
  protected stateParamName = 'state'
  protected scopeParamName = 'scope'
  protected scopesSeparator = ' '

  constructor(
    ctx: HttpContext,
    public config: AppleDriverConfig
  ) {
    super(ctx, config)
    this.loadState()
  }

  protected configureRedirectRequest(request: RedirectRequestContract<AppleScopes>) {
    request.scopes(this.config.scopes || ['name', 'email'])
    request.param('response_type', 'code')
    // Apple requires form_post when requesting the `name` scope.
    request.param('response_mode', 'form_post')
  }

  accessDenied(): boolean {
    const error = this.getError()
    if (!error) {
      return false
    }
    return error === 'access_denied' || error === 'user_cancelled_authorize'
  }

  /**
   * Exchange code for tokens using a freshly signed client_secret JWT.
   */
  async accessToken(callback?: (request: ApiRequestContract) => void): Promise<AppleAccessToken> {
    const clientSecret = await this.buildClientSecret()

    const token = await super.accessToken((request) => {
      request.field('client_id', this.config.clientId)
      request.field('client_secret', clientSecret)
      if (typeof callback === 'function') {
        callback(request)
      }
    })

    const raw = token as Oauth2AccessToken & { id_token?: unknown }
    const idToken = typeof raw.id_token === 'string' ? raw.id_token : ''

    return {
      ...token,
      idToken,
      refreshToken: token.refreshToken,
    }
  }

  async user(callback?: (request: ApiRequestContract) => void): Promise<AllyUserContract<AppleAccessToken>> {
    const token = await this.accessToken(callback)
    const formUser = this.readFormUser()
    const profile = await this.getUserInfo(token.idToken, formUser)

    return {
      ...profile,
      token,
    }
  }

  async userFromToken(
    idToken: string,
    _callback?: (request: ApiRequestContract) => void
  ): Promise<AllyUserContract<{ token: string; type: 'bearer' }>> {
    const profile = await this.getUserInfo(idToken, null)
    return {
      ...profile,
      token: { token: idToken, type: 'bearer' as const },
    }
  }

  private async buildClientSecret(): Promise<string> {
    if (this.config.teamId && this.config.keyId && this.config.privateKey) {
      return generateAppleClientSecret({
        clientId: this.config.clientId,
        teamId: this.config.teamId,
        keyId: this.config.keyId,
        privateKey: this.config.privateKey,
      })
    }

    // Legacy: static JWT already stored in APPLE_CLIENT_SECRET (not recommended).
    if (this.config.clientSecret) {
      return this.config.clientSecret
    }

    throw new Error(
      'Apple Sign In requires APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY (runtime JWT)'
    )
  }

  /**
   * Apple posts `user` (JSON) only on the first authorization.
   */
  private readFormUser(): AppleFormUser | null {
    const raw = this.ctx.request.input('user')
    if (!raw || typeof raw !== 'string') {
      return null
    }
    try {
      return JSON.parse(raw) as AppleFormUser
    } catch {
      return null
    }
  }

  private async getUserInfo(idToken: string, formUser: AppleFormUser | null) {
    if (!idToken) {
      throw new Error('Apple Sign In response is missing id_token')
    }

    const { payload } = await jwtVerify(idToken, appleJwks, {
      issuer: 'https://appleid.apple.com',
      audience: this.config.clientId,
    })

    const claims = payload as AppleIdTokenClaims
    const email = claims.email ?? formUser?.email ?? null
    const firstName = formUser?.name?.firstName?.trim() || ''
    const lastName = formUser?.name?.lastName?.trim() || ''
    const name = [firstName, lastName].filter(Boolean).join(' ')
    const nickName = email?.split('@')[0] || claims.sub || 'apple'

    return {
      id: String(claims.sub),
      nickName,
      name: name || nickName,
      email,
      avatarUrl: null,
      emailVerificationState: this.resolveEmailVerification(claims.email_verified),
      original: { claims, formUser },
    }
  }

  private resolveEmailVerification(
    value: AppleIdTokenClaims['email_verified']
  ): 'verified' | 'unverified' | 'unsupported' {
    if (value === true || value === 'true') {
      return 'verified'
    }
    if (value === false || value === 'false') {
      return 'unverified'
    }
    // Apple private relay / omitted claim — treat as verified ownership via SIWA.
    return 'verified'
  }
}

/**
 * Factory for `config/ally.ts` (same shape as `@adonisjs/ally` services.*).
 */
export function appleAllyService(config: AppleDriverConfig) {
  return (ctx: HttpContext) => new AppleDriver(ctx, config)
}
