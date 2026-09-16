import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import SocialAuthService, { SocialAuthError } from '#services/social_auth_service'

test.group('SocialAuthService Google', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a user from a Google profile with verified email', async ({ assert }) => {
    const social = new SocialAuthService()
    const { user, created } = await social.findOrCreateFromGoogle({
      email: 'google.user@example.com',
      name: 'Google User',
      nickName: 'g_user',
      avatarUrl: 'https://example.com/a.png',
      emailVerificationState: 'verified',
    })

    assert.isTrue(created)
    assert.equal(user.email, 'google.user@example.com')
    assert.equal(user.fullName, 'Google User')
    assert.equal(user.pseudo, 'g_user')
    assert.isTrue(user.emailVerified)
    assert.equal(user.image, 'https://example.com/a.png')

    const token = await User.accessTokens.create(user)
    assert.isString(token.value!.release())
    assert.isNotNull(token.expiresAt)
  })

  test('reclaims an unverified email/password account on verified Google login', async ({
    assert,
  }) => {
    const existing = await User.create({
      email: 'lien@example.com',
      password: 'motdepasse1',
      pseudo: 'lien_local',
      isPublic: false,
      emailVerified: false,
    })
    await User.accessTokens.create(existing)
    assert.isAbove((await User.accessTokens.all(existing)).length, 0)

    const social = new SocialAuthService()
    const { user, created } = await social.findOrCreateFromGoogle({
      email: 'lien@example.com',
      name: 'Lien Google',
      nickName: 'other',
      avatarUrl: null,
      emailVerificationState: 'verified',
    })

    assert.isFalse(created)
    assert.equal(user.id, existing.id)
    assert.equal(user.pseudo, 'lien_local')
    assert.isTrue(user.emailVerified)
    assert.equal(user.fullName, 'Lien Google')
    assert.isFalse(await hash.verify(user.password, 'motdepasse1'))
    assert.lengthOf(await User.accessTokens.all(existing), 0)
  })

  test('links a verified local account without rotating the password', async ({ assert }) => {
    const existing = await User.create({
      email: 'verifie@example.com',
      password: 'motdepasse1',
      pseudo: 'deja_ok',
      isPublic: false,
      emailVerified: true,
    })

    const social = new SocialAuthService()
    const { user } = await social.findOrCreateFromGoogle({
      email: 'verifie@example.com',
      name: 'Verifie Google',
      nickName: 'x',
      emailVerificationState: 'verified',
    })

    assert.equal(user.id, existing.id)
    assert.isTrue(await hash.verify(user.password, 'motdepasse1'))
  })

  test('refuses to link an unverified local account when Google email is unverified', async ({
    assert,
  }) => {
    await User.create({
      email: 'squat@example.com',
      password: 'motdepasse1',
      pseudo: 'squatter',
      isPublic: false,
      emailVerified: false,
    })

    const social = new SocialAuthService()
    await assert.rejects(async () => {
      await social.findOrCreateFromGoogle({
        email: 'squat@example.com',
        name: 'Nope',
        nickName: 'nope',
        emailVerificationState: 'unverified',
      })
    }, SocialAuthError)
  })

  test('rejects Google profiles without an email', async ({ assert }) => {
    const social = new SocialAuthService()
    await assert.rejects(async () => {
      await social.findOrCreateFromGoogle({
        email: null,
        name: 'No Mail',
        nickName: 'nomail',
        emailVerificationState: 'unsupported',
      })
    }, SocialAuthError)
  })

  test('allocates a unique pseudo when the nickname is taken', async ({ assert }) => {
    await User.create({
      email: 'first@example.com',
      password: 'motdepasse1',
      pseudo: 'taken',
      isPublic: false,
      emailVerified: true,
    })

    const social = new SocialAuthService()
    const { user } = await social.findOrCreateFromGoogle({
      email: 'second@example.com',
      name: 'Second',
      nickName: 'taken',
      emailVerificationState: 'verified',
    })

    assert.equal(user.pseudo, 'taken2')
  })
})
