import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'

test.group('Auth email/password', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const credentials = {
    email: 'soif@example.com',
    password: 'motdepasse1',
    passwordConfirmation: 'motdepasse1',
    fullName: 'Soif Test',
  }

  test('signup creates user, hashes password, and returns bearer token', async ({
    client,
    assert,
  }) => {
    using _fake = mail.fake()
    const response = await client.post('/api/v1/auth/signup').json(credentials)

    response.assertStatus(200)
    const body = response.body() as {
      data: { type: string; token: string; user: { id: number; email: string; pseudo: null } }
    }

    assert.equal(body.data.type, 'bearer')
    assert.isString(body.data.token)
    assert.isAbove(body.data.token.length, 10)
    assert.equal(body.data.user.email, credentials.email)
    assert.property(body.data.user, 'pseudo')
    assert.property(body.data.user, 'isPublic')

    const user = await User.findByOrFail('email', credentials.email)
    assert.notEqual(user.password, credentials.password)
    assert.isTrue(await hash.verify(user.password, credentials.password))
  })

  test('login returns bearer token for valid credentials', async ({ client, assert }) => {
    using _fake = mail.fake()
    await client.post('/api/v1/auth/signup').json(credentials)

    const response = await client.post('/api/v1/auth/login').json({
      email: credentials.email,
      password: credentials.password,
    })

    response.assertStatus(200)
    const body = response.body() as {
      data: { type: string; token: string; user: { email: string } }
    }
    assert.equal(body.data.type, 'bearer')
    assert.isString(body.data.token)
    assert.equal(body.data.user.email, credentials.email)
  })

  test('login rejects invalid password with 401 JSON error', async ({ client, assert }) => {
    using _fake = mail.fake()
    await client.post('/api/v1/auth/signup').json(credentials)

    const response = await client
      .post('/api/v1/auth/login')
      .header('Accept', 'application/json')
      .json({
        email: credentials.email,
        password: 'mauvais-mot-de-passe',
      })

    response.assertStatus(401)
    const body = response.body() as { errors?: unknown[]; message?: string; code?: string }
    assert.isTrue(
      Boolean(body.message || body.errors || body.code),
      'expected a clear JSON error payload'
    )
  })

  test('profile returns current user when authenticated', async ({ client, assert }) => {
    using _fake = mail.fake()
    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    const token = (signup.body() as { data: { token: string } }).data.token

    const response = await client
      .get('/api/v1/account/profile')
      .bearerToken(token)
      .header('Accept', 'application/json')

    response.assertStatus(200)
    const body = response.body() as {
      data: {
        id: number
        email: string
        pseudo: string | null
        isPublic: boolean
        emailVerified: boolean
      }
    }

    assert.equal(body.data.email, credentials.email)
    assert.property(body.data, 'id')
    assert.property(body.data, 'pseudo')
    assert.property(body.data, 'isPublic')
    assert.property(body.data, 'emailVerified')
  })

  test('logout revokes the current access token', async ({ client, assert }) => {
    using _fake = mail.fake()
    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    const token = (signup.body() as { data: { token: string } }).data.token

    const logout = await client
      .post('/api/v1/account/logout')
      .bearerToken(token)
      .header('Accept', 'application/json')

    logout.assertStatus(200)

    const profile = await client
      .get('/api/v1/account/profile')
      .bearerToken(token)
      .header('Accept', 'application/json')

    profile.assertStatus(401)
    assert.isTrue(true)
  })
})
