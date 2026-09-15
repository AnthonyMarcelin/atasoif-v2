/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import HealthController from '#controllers/health_controller'

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
        router.post('forgot-password', [controllers.PasswordResets, 'store'])
        router.post('reset-password', [controllers.PasswordResets, 'update'])
        router.post('verify-email', [controllers.EmailVerifications, 'store'])
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
        router.post('resend-verification', [controllers.EmailVerifications, 'resend'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
