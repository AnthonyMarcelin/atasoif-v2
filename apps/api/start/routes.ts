/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
const HealthController = () => import('#controllers/health_controller')
const GoogleAuthController = () => import('#controllers/google_auth_controller')
const FacebookAuthController = () => import('#controllers/facebook_auth_controller')

router.get('/health', [HealthController, 'handle'])

router.get('/', () => {
  return { hello: 'world', app: 'atasoif-api' }
})

router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
        router.post('email/verify', [controllers.EmailVerifications, 'store'])
        router.post('forgot-password', [controllers.PasswordResets, 'store'])
        router.post('reset-password', [controllers.PasswordResets, 'update'])
        router.get('google/redirect', [GoogleAuthController, 'redirect'])
        router.get('google/callback', [GoogleAuthController, 'callback'])
        router.get('facebook/redirect', [FacebookAuthController, 'redirect'])
        router.get('facebook/callback', [FacebookAuthController, 'callback'])
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
        router.post('email/resend', [controllers.EmailVerifications, 'resend'])

        router
          .group(() => {
            router.patch('profile', [controllers.Profile, 'update'])
          })
          .use(middleware.emailVerified())
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
