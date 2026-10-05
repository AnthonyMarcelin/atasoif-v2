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
const AppleAuthController = () => import('#controllers/apple_auth_controller')
const CatalogBottlesController = () => import('#controllers/catalog_bottles_controller')
const CatalogCategoriesController = () => import('#controllers/catalog_categories_controller')
const CollectionBottlesController = () => import('#controllers/collection_bottles_controller')
const CollectionPhotosController = () => import('#controllers/collection_photos_controller')
const FriendsController = () => import('#controllers/friends_controller')
const MagicLinksController = () => import('#controllers/magic_links_controller')
const StoreReviewController = () => import('#controllers/store_review_controller')
const OpsKpisController = () => import('#controllers/ops_kpis_controller')

router.get('/health', [HealthController, 'handle'])

router
  .get('/api/v1/media/catalog/:name', [CollectionPhotosController, 'showCatalog'])
  .use([middleware.auth(), middleware.emailVerified()])

router
  .get('/api/v1/media/off/:name', [CollectionPhotosController, 'showOffCatalog'])
  .use([middleware.auth(), middleware.emailVerified()])

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
        router.post('magic-link', [MagicLinksController, 'store'])
        router.post('magic-link/consume', [MagicLinksController, 'update'])
        router
          .post('store-review', [StoreReviewController, 'store'])
          .use(
            middleware.throttle({
              maxAttempts: 10,
              windowMs: 15 * 60 * 1000,
              bucket: 'store-review',
            })
          )
        router.get('google/redirect', [GoogleAuthController, 'redirect'])
        router.get('google/callback', [GoogleAuthController, 'callback'])
        router.get('facebook/redirect', [FacebookAuthController, 'redirect'])
        router.get('facebook/callback', [FacebookAuthController, 'callback'])
        router.get('apple/redirect', [AppleAuthController, 'redirect']).as('apple.redirect')
        // Apple uses response_mode=form_post → POST callback; GET kept for parity.
        router.get('apple/callback', [AppleAuthController, 'callback']).as('apple.callback')
        router.post('apple/callback', [AppleAuthController, 'callback']).as('apple.callback.post')
      })
      .prefix('auth')
      .as('auth')
      .use(middleware.throttle({ maxAttempts: 30, windowMs: 15 * 60 * 1000 }))

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
        router
          .post('email/resend', [controllers.EmailVerifications, 'resend'])
          .use(middleware.throttle({ maxAttempts: 5, windowMs: 15 * 60 * 1000 }))

        router
          .group(() => {
            router.patch('profile', [controllers.Profile, 'update'])
          })
          .use(middleware.emailVerified())
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('categories', [CatalogCategoriesController, 'index'])
        router.get('bottles', [CatalogBottlesController, 'index'])
        router.get('bottles/barcode/:barcode', [CatalogBottlesController, 'showByBarcode']).use(
          middleware.throttle({
            maxAttempts: 60,
            windowMs: 15 * 60 * 1000,
            bucket: 'catalog-barcode',
          })
        )
        router.get('bottles/:id', [CatalogBottlesController, 'show'])
      })
      .prefix('catalog')
      .as('catalog')
      .use([middleware.auth(), middleware.emailVerified()])

    router
      .group(() => {
        router.get('kpis', [OpsKpisController, 'index'])
      })
      .prefix('ops')
      .as('ops')
      .use([middleware.throttle({ maxAttempts: 60, windowMs: 60 * 1000 }), middleware.opsToken()])

    router
      .group(() => {
        router.get('bottles', [CollectionBottlesController, 'index'])
        router.post('bottles', [CollectionBottlesController, 'store'])
        router.post('bottles/:id/photo', [CollectionPhotosController, 'store']).use(
          middleware.throttle({
            maxAttempts: 30,
            windowMs: 15 * 60 * 1000,
            bucket: 'cellar-photo',
          })
        )
        router.get('bottles/:id/photo', [CollectionPhotosController, 'show'])
        router.get('bottles/:id', [CollectionBottlesController, 'show'])
        router.patch('bottles/:id', [CollectionBottlesController, 'update'])
        router.delete('bottles/:id', [CollectionBottlesController, 'destroy'])
      })
      .prefix('collection')
      .as('collection')
      .use([middleware.auth(), middleware.emailVerified()])

    router
      .group(() => {
        router.get('/', [FriendsController, 'index'])
        router.get('/share', [FriendsController, 'shareShow'])
        router.patch('/share', [FriendsController, 'shareUpdate'])
        router.post('/', [FriendsController, 'store']).use(
          middleware.throttle({
            maxAttempts: 30,
            windowMs: 15 * 60 * 1000,
            bucket: 'friends-invite',
          })
        )
        router.post('/:id/respond', [FriendsController, 'respond'])
        router.delete('/:id/block', [FriendsController, 'unblock'])
      })
      .prefix('friends')
      .as('friends')
      .use([middleware.auth(), middleware.emailVerified()])
  })
  .prefix('/api/v1')
