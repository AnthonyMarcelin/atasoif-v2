import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import SocialAuthService, { SocialAuthError } from '#services/social_auth_service'

test.group('SocialAuthService Facebook', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a user from a Facebook profile', async ({ assert }) => {
    const social = new SocialAuthService()
    const { user, created } = await social.findOrCreateFromFacebook({
      email: 'fb.user@example.com',
      name: 'FB User',
      nickName: 'fb_user',
      avatarUrl: 'https://example.com/fb.png',
      emailVerificationState: 'verified',
    })

    assert.isTrue(created)
    assert.equal(user.email, 'fb.user@example.com')
    assert.equal(user.pseudo, 'fb_user')
    assert.isTrue(user.emailVerified)

    const token = await User.accessTokens.create(user)
    assert.isString(token.value!.release())
    assert.isNotNull(token.expiresAt)
  })

  test('creates an unverified user when Facebook email state is unsupported', async ({
    assert,
  }) => {
    const social = new SocialAuthService()
    const { user, created } = await social.findOrCreateFromFacebook({
      email: 'fb.soft@example.com',
      name: 'FB Soft',
      nickName: 'fb_soft',
      emailVerificationState: 'unsupported',
    })

    assert.isTrue(created)
    assert.isFalse(user.emailVerified)
  })

  test('reclaims an unverified local account on verified Facebook login', async ({ assert }) => {
    const existing = await User.create({
      email: 'lien.fb@example.com',
      password: 'motdepasse1',
      pseudo: 'lien_fb',
      isPublic: false,
      emailVerified: false,
    })

    const social = new SocialAuthService()
    const { user, created } = await social.findOrCreateFromFacebook({
      email: 'lien.fb@example.com',
      name: 'Lien FB',
      nickName: 'other',
      emailVerificationState: 'verified',
    })

    assert.isFalse(created)
    assert.equal(user.id, existing.id)
    assert.equal(user.pseudo, 'lien_fb')
    assert.isTrue(user.emailVerified)
    assert.isFalse(await hash.verify(user.password, 'motdepasse1'))
  })

  test('refuses linking unverified local + unsupported Facebook email', async ({ assert }) => {
    await User.create({
      email: 'fb.squat@example.com',
      password: 'motdepasse1',
      pseudo: 'fb_squat',
      isPublic: false,
      emailVerified: false,
    })

    const social = new SocialAuthService()
    await assert.rejects(async () => {
      await social.findOrCreateFromFacebook({
        email: 'fb.squat@example.com',
        name: 'Nope',
        nickName: 'nope',
        emailVerificationState: 'unsupported',
      })
    }, SocialAuthError)
  })

  test('rejects Facebook profiles without an email', async ({ assert }) => {
    const social = new SocialAuthService()
    await assert.rejects(async () => {
      await social.findOrCreateFromFacebook({
        email: null,
        name: 'No Mail',
        nickName: 'nomail',
        emailVerificationState: 'unsupported',
      })
    }, SocialAuthError)
  })
})
