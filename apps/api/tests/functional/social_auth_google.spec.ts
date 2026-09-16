import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import SocialAuthService, { SocialAuthError } from '#services/social_auth_service'

test.group('SocialAuthService Google', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a user from a Google profile with verified email', async ({ assert }) => {
    const social = new SocialAuthService()
    const user = await social.findOrCreateFromGoogle({
      email: 'google.user@example.com',
      name: 'Google User',
      nickName: 'g_user',
      avatarUrl: 'https://example.com/a.png',
      emailVerificationState: 'verified',
    })

    assert.equal(user.email, 'google.user@example.com')
    assert.equal(user.fullName, 'Google User')
    assert.equal(user.pseudo, 'g_user')
    assert.isTrue(user.emailVerified)
    assert.equal(user.image, 'https://example.com/a.png')

    const token = await User.accessTokens.create(user)
    assert.isString(token.value!.release())
  })

  test('links an existing email/password account on Google login', async ({ assert }) => {
    const existing = await User.create({
      email: 'lien@example.com',
      password: 'motdepasse1',
      pseudo: 'lien_local',
      isPublic: false,
      emailVerified: false,
    })

    const social = new SocialAuthService()
    const user = await social.findOrCreateFromGoogle({
      email: 'lien@example.com',
      name: 'Lien Google',
      nickName: 'other',
      avatarUrl: null,
      emailVerificationState: 'verified',
    })

    assert.equal(user.id, existing.id)
    assert.equal(user.pseudo, 'lien_local')
    assert.isTrue(user.emailVerified)
    assert.equal(user.fullName, 'Lien Google')
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
    const user = await social.findOrCreateFromGoogle({
      email: 'second@example.com',
      name: 'Second',
      nickName: 'taken',
      emailVerificationState: 'verified',
    })

    assert.equal(user.pseudo, 'taken2')
  })
})
