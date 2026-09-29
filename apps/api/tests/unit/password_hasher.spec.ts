import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import { passwordHasher } from '#services/password_hasher'

test.group('passwordHasher', () => {
  test('makes scrypt hashes and verifies them', async ({ assert }) => {
    const hasher = passwordHasher()
    const hashed = await hasher.make('motdepasse1')
    assert.isTrue(hashed.startsWith('$scrypt$'))
    assert.isTrue(await hasher.verify(hashed, 'motdepasse1'))
    assert.isFalse(await hasher.verify(hashed, 'wrong'))
  })

  test('verifies argon2id hashes used by v1 migrants', async ({ assert }) => {
    const argonHash = await hash.use('argon').make('motdepasse1')
    assert.isTrue(argonHash.startsWith('$argon2id$'))
    const hasher = passwordHasher()
    assert.isTrue(await hasher.verify(argonHash, 'motdepasse1'))
    assert.isFalse(await hasher.verify(argonHash, 'wrong'))
  })
})
