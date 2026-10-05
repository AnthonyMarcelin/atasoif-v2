import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'
import type { InferSocialProviders } from '@adonisjs/ally/types'
import { configProvider } from '@adonisjs/core'
import { appleAllyService } from '#services/apple_ally_driver'

const appUrl = (env.get('APP_URL') || 'http://localhost:3000').replace(/\/$/, '')

const allyConfig = defineConfig({
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID') || '',
    clientSecret: env.get('GOOGLE_CLIENT_SECRET') || '',
    // Same path shape as Spawnzone prod on Dokploy (API origin + /api/v1/auth/…).
    callbackUrl: `${appUrl}/api/v1/auth/google/callback`,
    // Email + basic profile only (no Calendar / Drive).
    scopes: ['openid', 'userinfo.email', 'userinfo.profile'],
    prompt: 'select_account',
  }),
  facebook: services.facebook({
    clientId: env.get('FACEBOOK_CLIENT_ID') || '',
    clientSecret: env.get('FACEBOOK_CLIENT_SECRET') || '',
    callbackUrl: `${appUrl}/api/v1/auth/facebook/callback`,
    // Login only — never request user_friends / friends graph (E6 is in-app).
    scopes: ['email', 'public_profile'],
    userFields: ['id', 'name', 'email', 'picture'],
  }),
  /**
   * Sign in with Apple — custom Ally driver.
   * Client secret JWT is signed at token-exchange time from APPLE_PRIVATE_KEY (.p8).
   * APPLE_CLIENT_SECRET is legacy/optional and unused when TEAM/KEY/PEM are set.
   */
  apple: configProvider.create(async () => {
    return appleAllyService({
      clientId: env.get('APPLE_CLIENT_ID') || '',
      clientSecret: env.get('APPLE_CLIENT_SECRET') || '',
      callbackUrl: `${appUrl}/api/v1/auth/apple/callback`,
      teamId: env.get('APPLE_TEAM_ID') || '',
      keyId: env.get('APPLE_KEY_ID') || '',
      privateKey: env.get('APPLE_PRIVATE_KEY') || '',
      bundleId: env.get('APPLE_BUNDLE_ID') || undefined,
      scopes: ['name', 'email'],
    })
  }),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
