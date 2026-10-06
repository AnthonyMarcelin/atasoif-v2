import { test } from '@japa/runner'
import {
  buildFrontendLoginErrorRedirect,
  buildFrontendOAuthRedirect,
  buildShareInviteUrl,
  nativeOAuthReturnBase,
} from '#services/frontend_url'

test.group('frontend_url OAuth + share helpers', () => {
  test('web OAuth redirect puts the token in the hash', ({ assert }) => {
    const url = buildFrontendOAuthRedirect('tok-abc', 'web')
    assert.include(url, '/auth/oauth/callback#')
    assert.include(url, 'token=tok-abc')
    assert.notInclude(url.split('#')[0]!, 'token=')
  })

  test('native OAuth redirect uses the custom scheme', ({ assert }) => {
    const url = buildFrontendOAuthRedirect('tok-native', 'native')
    assert.match(url, /^fr\.atasoif\.app:\/\//)
    assert.include(url, 'token=tok-native')
    assert.equal(nativeOAuthReturnBase().startsWith('fr.atasoif.app://'), true)
  })

  test('native login error redirect keeps the custom scheme', ({ assert }) => {
    const url = buildFrontendLoginErrorRedirect('apple_denied', 'native')
    assert.match(url, /^fr\.atasoif\.app:\/\//)
    assert.include(url, 'oauthError=apple_denied')
  })

  test('share invite URL uses the public marketing origin', ({ assert }) => {
    assert.equal(buildShareInviteUrl('F702EA'), 'https://atasoif.fr/i/F702EA')
  })
})
