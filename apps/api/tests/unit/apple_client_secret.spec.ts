import { test } from '@japa/runner'
import { exportPKCS8, generateKeyPair, jwtVerify } from 'jose'
import {
  APPLE_CLIENT_SECRET_TTL_SECONDS,
  generateAppleClientSecret,
  normalizeApplePrivateKeyPem,
} from '#services/apple_client_secret'

test.group('generateAppleClientSecret', () => {
  test('normalizes escaped newlines in PEM from env', ({ assert }) => {
    const normalized = normalizeApplePrivateKeyPem('-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n')
    assert.include(normalized, '\nABC\n')
    assert.notInclude(normalized, '\\n')
  })

  test('signs a short-lived ES256 JWT with Apple claims', async ({ assert }) => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    const pem = await exportPKCS8(privateKey)
    const now = Math.floor(Date.now() / 1000)

    const jwt = await generateAppleClientSecret({
      clientId: 'com.atasoif.web',
      teamId: 'D3UKXNVT3D',
      keyId: 'TESTKEYID1',
      privateKey: pem,
      nowSeconds: now,
    })

    const { payload, protectedHeader } = await jwtVerify(jwt, publicKey, {
      audience: 'https://appleid.apple.com',
      issuer: 'D3UKXNVT3D',
      subject: 'com.atasoif.web',
    })

    assert.equal(protectedHeader.alg, 'ES256')
    assert.equal(protectedHeader.kid, 'TESTKEYID1')
    assert.equal(payload.iat, now)
    assert.equal(payload.exp, now + APPLE_CLIENT_SECRET_TTL_SECONDS)
  })

  test('accepts PEM with literal \\n escapes', async ({ assert }) => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    const pem = await exportPKCS8(privateKey)
    const escaped = pem.replace(/\n/g, '\\n')

    const jwt = await generateAppleClientSecret({
      clientId: 'com.atasoif.web',
      teamId: 'D3UKXNVT3D',
      keyId: 'TESTKEYID1',
      privateKey: escaped,
    })

    const { payload } = await jwtVerify(jwt, publicKey, {
      audience: 'https://appleid.apple.com',
    })
    assert.equal(payload.iss, 'D3UKXNVT3D')
    assert.equal(payload.sub, 'com.atasoif.web')
  })

  test('rejects missing signing material without echoing the key', async ({ assert }) => {
    await assert.rejects(async () => {
      await generateAppleClientSecret({
        clientId: 'com.atasoif.web',
        teamId: 'D3UKXNVT3D',
        keyId: 'TESTKEYID1',
        privateKey: '',
      })
    }, /requires clientId, teamId, keyId, and privateKey/)
  })
})
