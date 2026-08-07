import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'
import type { InferSocialProviders } from '@adonisjs/ally/types'

const allyConfig = defineConfig({
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID') || '',
    clientSecret: env.get('GOOGLE_CLIENT_SECRET') || '',
    callbackUrl: `${env.get('APP_URL')}/oauth/google/callback`,
  }),
  facebook: services.facebook({
    clientId: env.get('FACEBOOK_CLIENT_ID') || '',
    clientSecret: env.get('FACEBOOK_CLIENT_SECRET') || '',
    callbackUrl: `${env.get('APP_URL')}/oauth/facebook/callback`,
  }),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}