import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import User from '#models/user'
import AuthEmailTokenService from '#services/auth_email_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'

test.group('Profile update', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const credentials = {
    email: 'profil@example.com',
    password: 'motdepasse1',
    passwordConfirmation: 'motdepasse1',
    fullName: 'Profil Test',
    pseudo: 'profil_base',
  }

  // Japa ApiClient — keep helper typing loose for readable setup.
  async function signupAndVerify(client: any) {
    using fake = mail.fake()
    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)
    const token = (signup.body() as { data: { token: string } }).data.token

    const user = await User.findByOrFail('email', credentials.email)
    const verifyToken = new AuthEmailTokenService().createEmailVerificationToken(user.id)
    await client.post('/api/v1/auth/email/verify').json({ token: verifyToken })

    return token as string
  }

  test('patch profile updates pseudo and isPublic', async ({ client, assert }) => {
    const token = await signupAndVerify(client)

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .header('Accept', 'application/json')
      .json({
        pseudo: 'nouveau_pseudo',
        isPublic: true,
      })

    response.assertStatus(200)
    const body = response.body() as {
      data: { pseudo: string | null; isPublic: boolean; email: string }
    }
    assert.equal(body.data.pseudo, 'nouveau_pseudo')
    assert.isTrue(body.data.isPublic)
    assert.equal(body.data.email, credentials.email)

    const user = await User.findByOrFail('email', credentials.email)
    assert.equal(user.pseudo, 'nouveau_pseudo')
    assert.isTrue(user.isPublic)
  })

  test('patch profile keeps own pseudo when unchanged', async ({ client, assert }) => {
    const token = await signupAndVerify(client)

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .header('Accept', 'application/json')
      .json({
        pseudo: credentials.pseudo,
        isPublic: true,
      })

    response.assertStatus(200)
    const body = response.body() as { data: { pseudo: string | null; isPublic: boolean } }
    assert.equal(body.data.pseudo, credentials.pseudo)
    assert.isTrue(body.data.isPublic)
  })

  test('patch profile rejects duplicate pseudo', async ({ client, assert }) => {
    using fake = mail.fake()
    await client.post('/api/v1/auth/signup').json({
      email: 'autre@example.com',
      password: 'motdepasse1',
      passwordConfirmation: 'motdepasse1',
      pseudo: 'deja_pris',
    })
    fake.mails.assertSent(VerifyEmailNotification)

    const token = await signupAndVerify(client)

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .header('Accept', 'application/json')
      .json({
        pseudo: 'deja_pris',
        isPublic: false,
      })

    response.assertStatus(422)
    const body = response.body() as { errors?: Array<{ field?: string }> }
    assert.isArray(body.errors)
    assert.isTrue(
      (body.errors ?? []).some((error) => error.field === 'pseudo'),
      'expected a validation error on pseudo'
    )
  })

  test('patch profile rejects invalid pseudo length', async ({ client }) => {
    const token = await signupAndVerify(client)

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .header('Accept', 'application/json')
      .json({
        pseudo: 'x',
        isPublic: false,
      })

    response.assertStatus(422)
  })

  test('patch profile requires authentication', async ({ client }) => {
    const response = await client
      .patch('/api/v1/account/profile')
      .header('Accept', 'application/json')
      .json({
        pseudo: 'sans_auth',
        isPublic: false,
      })

    response.assertStatus(401)
  })

  test('patch profile rejects unverified email with 403', async ({ client, assert }) => {
    using fake = mail.fake()
    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)
    const token = (signup.body() as { data: { token: string } }).data.token

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .header('Accept', 'application/json')
      .json({
        pseudo: 'bloqué',
        isPublic: false,
      })

    response.assertStatus(403)
    const body = response.body() as { code?: string; message?: string }
    assert.equal(body.code, 'E_EMAIL_UNVERIFIED')
    assert.isString(body.message)
  })
})
