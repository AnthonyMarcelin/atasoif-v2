import { test } from '@japa/runner'

test.group('GET /health', () => {
  test('returns status ok when Postgres is reachable', async ({ client, assert }) => {
    const response = await client.get('/health')

    response.assertStatus(200)
    response.assertBodyContains({
      app: 'atasoif-api',
      database: 'up',
      status: 'ok',
    })
    assert.equal((response.body() as { freeBottleLimit: number }).freeBottleLimit, 10)
  })
})

test.group('Auth bootstrap', () => {
  test('account profile requires authentication', async ({ client }) => {
    const response = await client.get('/api/v1/account/profile')
    response.assertStatus(401)
  })

  test('CORS allows apps/web origin', async ({ client, assert }) => {
    const response = await client
      .options('/api/v1/auth/login')
      .header('Origin', 'http://localhost:4200')
      .header('Access-Control-Request-Method', 'POST')

    response.assertStatus(204)
    assert.equal(response.header('access-control-allow-origin'), 'http://localhost:4200')
    assert.equal(response.header('access-control-allow-credentials'), 'true')
  })
})
