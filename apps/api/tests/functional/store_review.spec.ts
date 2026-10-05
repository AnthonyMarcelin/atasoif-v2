import { test } from '@japa/runner'
import env from '#start/env'

const REVIEW_SECRET = 'atasoif-store-review-test'

test.group('Store review bypass', (group) => {
  group.each.setup(() => {
    env.set('STORE_REVIEW_SECRET', '')
  })

  test('rejects when the secret is not configured', async ({ client }) => {
    const response = await client
      .post('/api/v1/auth/store-review')
      .json({ secret: REVIEW_SECRET })
      .header('Accept', 'application/json')

    response.assertStatus(401)
    response.assertBodyContains({ code: 'E_STORE_REVIEW_UNAUTHORIZED' })
  })

  test('rejects a wrong secret', async ({ client }) => {
    env.set('STORE_REVIEW_SECRET', REVIEW_SECRET)
    const response = await client
      .post('/api/v1/auth/store-review')
      .json({ secret: 'not-the-review-secret' })
      .header('Accept', 'application/json')

    response.assertStatus(401)
    response.assertBodyContains({ code: 'E_STORE_REVIEW_UNAUTHORIZED' })
  })

  test('accepts the matching secret', async ({ client }) => {
    env.set('STORE_REVIEW_SECRET', REVIEW_SECRET)
    const response = await client
      .post('/api/v1/auth/store-review')
      .json({ secret: REVIEW_SECRET })
      .header('Accept', 'application/json')

    response.assertStatus(200)
    response.assertBodyContains({ ok: true })
  })

  test('rejects a blank body secret', async ({ client }) => {
    env.set('STORE_REVIEW_SECRET', REVIEW_SECRET)
    const response = await client
      .post('/api/v1/auth/store-review')
      .json({ secret: '' })
      .header('Accept', 'application/json')

    response.assertStatus(422)
  })
})
