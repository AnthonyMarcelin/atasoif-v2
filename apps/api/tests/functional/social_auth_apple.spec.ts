import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import SocialAuthService, { SocialAuthError } from '#services/social_auth_service'

test.group('SocialAuthService Apple', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a user from an Apple profile with verified email', async ({ assert }) => {
    const social = new SocialAuthService()
    const { user, created } = await social.findOrCreateFromApple({
      email: 'apple.user@example.com',
      name: 'Apple User',
      nickName: 'a_user',
      avatarUrl: null,
      emailVerificationState: 'verified',
    })

    assert.isTrue(created)
    assert.equal(user.email, 'apple.user@example.com')
    assert.equal(user.fullName, 'Apple User')
    assert.equal(user.pseudo, 'a_user')
    assert.isTrue(user.emailVerified)

    const token = await User.accessTokens.create(user)
    assert.isString(token.value!.release())
    assert.isNotNull(token.expiresAt)
  })

  test('reclaims an unverified email/password account on verified Apple login', async ({
    assert,
  }) => {
    const existing = await User.create({
      email: 'lien.apple@example.com',
      password: 'motdepasse1',
      pseudo: 'lien_apple',
      isPublic: false,
      emailVerified: false,
    })
    await User.accessTokens.create(existing)

    const social = new SocialAuthService()
    const { user, created } = await social.findOrCreateFromApple({
      email: 'lien.apple@example.com',
      name: 'Lien Apple',
      nickName: 'other',
      avatarUrl: null,
      emailVerificationState: 'verified',
    })

    assert.isFalse(created)
    assert.equal(user.id, existing.id)
    assert.isTrue(user.emailVerified)
    assert.equal(user.fullName, 'Lien Apple')
    assert.isFalse(await hash.verify(user.password, 'motdepasse1'))
    assert.lengthOf(await User.accessTokens.all(existing), 0)
  })

  test('rejects Apple profiles without an email', async ({ assert }) => {
    const social = new SocialAuthService()
    await assert.rejects(async () => {
      await social.findOrCreateFromApple({
        email: null,
        name: 'No Mail',
        nickName: 'nomail',
        emailVerificationState: 'verified',
      })
    }, SocialAuthError)
  })
})
