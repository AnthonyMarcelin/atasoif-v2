import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import SocialAuthService, { SocialAuthError } from '#services/social_auth_service'

test.group('SocialAuthService Facebook', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a user from a Facebook profile', async ({ assert }) => {
    const social = new SocialAuthService()
    const user = await social.findOrCreateFromFacebook({
      email: 'fb.user@example.com',
      name: 'FB User',
      nickName: 'fb_user',
      avatarUrl: 'https://example.com/fb.png',
      emailVerificationState: 'verified',
    })

    assert.equal(user.email, 'fb.user@example.com')
    assert.equal(user.pseudo, 'fb_user')
    assert.isTrue(user.emailVerified)

    const token = await User.accessTokens.create(user)
    assert.isString(token.value!.release())
  })

  test('links an existing account on Facebook login', async ({ assert }) => {
    const existing = await User.create({
      email: 'lien.fb@example.com',
      password: 'motdepasse1',
      pseudo: 'lien_fb',
      isPublic: false,
      emailVerified: false,
    })

    const social = new SocialAuthService()
    const user = await social.findOrCreateFromFacebook({
      email: 'lien.fb@example.com',
      name: 'Lien FB',
      nickName: 'other',
      emailVerificationState: 'verified',
    })

    assert.equal(user.id, existing.id)
    assert.equal(user.pseudo, 'lien_fb')
    assert.isTrue(user.emailVerified)
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
