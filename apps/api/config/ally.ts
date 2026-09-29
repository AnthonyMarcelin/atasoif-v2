import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'
import type { InferSocialProviders } from '@adonisjs/ally/types'

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
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
