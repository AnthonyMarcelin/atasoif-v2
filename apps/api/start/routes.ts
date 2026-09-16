/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
const HealthController = () => import('#controllers/health_controller')

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
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.patch('profile', [controllers.Profile, 'update'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
        router.post('email/resend', [controllers.EmailVerifications, 'resend'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
