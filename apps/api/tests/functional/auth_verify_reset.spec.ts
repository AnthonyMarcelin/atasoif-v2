import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import AuthTokenService from '#services/auth_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'
import PasswordResetNotification from '#mails/password_reset_notification'

test.group('Auth verify email + password reset', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const credentials = {
    email: 'cave@example.com',
    password: 'motdepasse1',
    passwordConfirmation: 'motdepasse1',
    fullName: 'Cave Test',
  }

  test('signup sends verification email and leaves emailVerified false', async ({
    client,
    assert,
  }) => {
    using fake = mail.fake()

    const response = await client.post('/api/v1/auth/signup').json(credentials)
    response.assertStatus(200)

    const body = response.body() as { data: { user: { emailVerified: boolean } } }
    assert.isFalse(body.data.user.emailVerified)

    fake.mails.assertSent(VerifyEmailNotification, ({ message }) => {
      return message.hasTo(credentials.email) && message.hasSubject('Confirme ton email — À ta soif !')
    })
  })

  test('verify-email marks the user as verified', async ({ client, assert }) => {
    using fake = mail.fake()

    await client.post('/api/v1/auth/signup').json(credentials)
    const user = await User.findByOrFail('email', credentials.email)
    const token = new AuthTokenService().createEmailVerificationToken(user.id)

    const response = await client.post('/api/v1/auth/verify-email').json({ token })
    response.assertStatus(200)

    const body = response.body() as { data: { emailVerified: boolean; email: string } }
    assert.isTrue(body.data.emailVerified)
    assert.equal(body.data.email, credentials.email)

    await user.refresh()
    assert.isTrue(user.emailVerified)
    assert.isTrue(fake.mails.sent().length >= 1)
  })

  test('verify-email rejects invalid token with 400', async ({ client }) => {
    using _fake = mail.fake()

    const response = await client.post('/api/v1/auth/verify-email').json({ token: 'invalid' })
    response.assertStatus(400)
  })

  test('forgot + reset password updates hash and revokes tokens', async ({ client, assert }) => {
    using fake = mail.fake()

    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    const oldToken = (signup.body() as { data: { token: string } }).data.token
    const user = await User.findByOrFail('email', credentials.email)

    const forgot = await client.post('/api/v1/auth/forgot-password').json({
      email: credentials.email,
    })
    forgot.assertStatus(200)
    assert.include((forgot.body() as { message: string }).message, 'Si un compte existe')

    fake.mails.assertSent(PasswordResetNotification, ({ message }) => {
      return (
        message.hasTo(credentials.email) &&
        message.hasSubject('Réinitialise ton mot de passe — À ta soif !')
      )
    })

    const resetToken = new AuthTokenService().createPasswordResetToken(user.id)
    const newPassword = 'nouveaumdp1'

    const reset = await client.post('/api/v1/auth/reset-password').json({
      token: resetToken,
      password: newPassword,
      passwordConfirmation: newPassword,
    })
    reset.assertStatus(200)

    await user.refresh()
    assert.isTrue(await hash.verify(user.password, newPassword))

    const profile = await client
      .get('/api/v1/account/profile')
      .bearerToken(oldToken)
      .header('Accept', 'application/json')
    profile.assertStatus(401)

    const login = await client.post('/api/v1/auth/login').json({
      email: credentials.email,
      password: newPassword,
    })
    login.assertStatus(200)
  })

  test('forgot-password returns the same message for unknown email', async ({ client, assert }) => {
    using fake = mail.fake()

    const response = await client.post('/api/v1/auth/forgot-password').json({
      email: 'inconnu@example.com',
    })
    response.assertStatus(200)
    assert.include((response.body() as { message: string }).message, 'Si un compte existe')
    fake.mails.assertNotSent(PasswordResetNotification)
  })

  test('reset-password rejects invalid token with 400', async ({ client }) => {
    using _fake = mail.fake()

    const response = await client.post('/api/v1/auth/reset-password').json({
      token: 'invalid',
      password: 'nouveaumdp1',
      passwordConfirmation: 'nouveaumdp1',
    })
    response.assertStatus(400)
  })
})
