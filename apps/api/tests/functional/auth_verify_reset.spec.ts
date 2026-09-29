import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import User from '#models/user'
import AuthEmailTokenService from '#services/auth_email_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'
import PasswordResetNotification from '#mails/password_reset_notification'

test.group('Auth email verification + password reset', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const credentials = {
    email: 'cave@example.com',
    password: 'motdepasse1',
    passwordConfirmation: 'motdepasse1',
    fullName: 'Cave Test',
  }

  test('signup sends verification email (Nuit copy)', async ({ client }) => {
    using fake = mail.fake()

    const response = await client.post('/api/v1/auth/signup').json(credentials)
    response.assertStatus(200)

    fake.mails.assertSent(VerifyEmailNotification, ({ message }) => {
      return (
        message.hasTo(credentials.email) && message.hasSubject('Confirme ton adresse · À ta soif')
      )
    })

    const user = await User.findByOrFail('email', credentials.email)
    assertUnverified(user)
  })

  test('verify email marks user as verified', async ({ client, assert }) => {
    using fake = mail.fake()

    await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)

    const user = await User.findByOrFail('email', credentials.email)
    const token = new AuthEmailTokenService().createEmailVerificationToken(user.id)

    const response = await client.post('/api/v1/auth/email/verify').json({ token })
    response.assertStatus(200)

    await user.refresh()
    assert.isTrue(user.emailVerified)
    const body = response.body() as { data: { emailVerified: boolean; email: string } }
    assert.equal(body.data.email, credentials.email)
    assert.isTrue(body.data.emailVerified)
  })

  test('verify email rejects invalid token', async ({ client }) => {
    using fake = mail.fake()
    await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)

    const response = await client
      .post('/api/v1/auth/email/verify')
      .header('Accept', 'application/json')
      .json({ token: 'not-a-valid-token' })

    response.assertStatus(400)
  })

  test('forgot password sends reset email for existing user', async ({ client }) => {
    using fake = mail.fake()

    await client.post('/api/v1/auth/signup').json(credentials)

    const response = await client
      .post('/api/v1/auth/forgot-password')
      .json({ email: credentials.email })

    response.assertStatus(200)
    fake.mails.assertSent(PasswordResetNotification, ({ message }) => {
      return (
        message.hasTo(credentials.email) &&
        message.hasSubject('Réinitialise ton mot de passe · À ta soif')
      )
    })
  })

  test('forgot password does not leak unknown emails and sends nothing', async ({
    client,
    assert,
  }) => {
    using fake = mail.fake()

    const response = await client
      .post('/api/v1/auth/forgot-password')
      .json({ email: 'inconnu@example.com' })

    response.assertStatus(200)
    const body = response.body() as { message: string }
    assert.include(body.message.toLowerCase(), 'si un compte existe')
    fake.mails.assertNotSent(PasswordResetNotification)
  })

  test('reset password updates hash, revokes tokens, and allows login', async ({
    client,
    assert,
  }) => {
    using fake = mail.fake()

    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    const oldToken = (signup.body() as { data: { token: string } }).data.token

    const user = await User.findByOrFail('email', credentials.email)
    user.passwordResetVersion = 1
    await user.save()
    const resetToken = new AuthEmailTokenService().createPasswordResetToken(
      user.id,
      user.passwordResetVersion
    )
    const newPassword = 'nouveaumdp1'

    const reset = await client.post('/api/v1/auth/reset-password').json({
      token: resetToken,
      password: newPassword,
      passwordConfirmation: newPassword,
    })
    reset.assertStatus(200)

    await user.refresh()
    assert.isTrue(await hash.verify(user.password, newPassword))
    assert.equal(user.passwordResetVersion, 2)

    const profileWithOld = await client
      .get('/api/v1/account/profile')
      .bearerToken(oldToken)
      .header('Accept', 'application/json')
    profileWithOld.assertStatus(401)

    const reuse = await client.post('/api/v1/auth/reset-password').json({
      token: resetToken,
      password: 'autremdp12',
      passwordConfirmation: 'autremdp12',
    })
    reuse.assertStatus(400)

    const login = await client.post('/api/v1/auth/login').json({
      email: credentials.email,
      password: newPassword,
    })
    login.assertStatus(200)
    fake.mails.assertSent(VerifyEmailNotification)
  })

  test('signup rejects duplicate email without naming the field', async ({ client, assert }) => {
    using fake = mail.fake()
    await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)

    const response = await client
      .post('/api/v1/auth/signup')
      .header('Accept', 'application/json')
      .json({
        ...credentials,
        email: credentials.email.toUpperCase(),
        pseudo: 'autre_pseudo',
      })

    response.assertStatus(422)
    const body = response.body() as { errors?: Array<{ field?: string; message?: string }> }
    assert.isArray(body.errors)
    assert.isTrue((body.errors ?? []).every((error) => !error.field))
    assert.include((body.errors?.[0]?.message ?? '').toLowerCase(), 'impossible de créer')
  })

  test('reset password rejects invalid token', async ({ client }) => {
    using fake = mail.fake()
    await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)

    const response = await client
      .post('/api/v1/auth/reset-password')
      .header('Accept', 'application/json')
      .json({
        token: 'bad-token',
        password: 'nouveaumdp1',
        passwordConfirmation: 'nouveaumdp1',
      })

    response.assertStatus(400)
  })
})

function assertUnverified(user: User) {
  if (user.emailVerified) {
    throw new Error('expected newly signed-up user to be unverified')
  }
}
