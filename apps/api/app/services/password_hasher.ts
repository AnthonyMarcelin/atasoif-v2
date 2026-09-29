import hash from '@adonisjs/core/services/hash'
import type { Hash } from '@adonisjs/core/hash'

/**
 * Auth finder hasher: new passwords → scrypt; verify accepts scrypt + legacy argon2id (v1).
 */
export function passwordHasher(): Hash {
  const hasher = {
    make(value: string) {
      return hash.use('scrypt').make(value)
    },
    verify(hashedValue: string, plainValue: string) {
      if (hashedValue.startsWith('$argon2')) {
        return hash.use('argon').verify(hashedValue, plainValue)
      }
      return hash.use('scrypt').verify(hashedValue, plainValue)
    },
    isValidHash(value: string) {
      if (value.startsWith('$argon2')) {
        return hash.use('argon').isValidHash(value)
      }
      return hash.use('scrypt').isValidHash(value)
    },
    needsReHash(value: string) {
      if (value.startsWith('$argon2')) {
        // Optional later: re-hash to scrypt on login. Keep argon2id valid for T11.
        return false
      }
      return hash.use('scrypt').needsReHash(value)
    },
    assertEquals(hashedValue: string, plainValue: string) {
      return hash.use(valueDriver(hashedValue)).assertEquals(hashedValue, plainValue)
    },
    assertNotEquals(hashedValue: string, plainValue: string) {
      return hash.use(valueDriver(hashedValue)).assertNotEquals(hashedValue, plainValue)
    },
  }
  return hasher as Hash
}

function valueDriver(hashedValue: string): 'argon' | 'scrypt' {
  return hashedValue.startsWith('$argon2') ? 'argon' : 'scrypt'
}
