import hash from '@adonisjs/core/services/hash'

/**
 * AuthFinder calls `hashFactory().verify` / `.make` on the default manager.
 * Adonis HashManager.verify always uses the *default* driver, so a scrypt
 * default cannot verify `$argon2id$` PHC strings from v1.
 *
 * This adapter keeps scrypt for new hashes and routes verify by PHC prefix.
 */
export function createPasswordHasher() {
  return {
    make(value: string) {
      return hash.make(value)
    },
    verify(hashedValue: string, plainValue: string) {
      if (hashedValue.startsWith('$argon2')) {
        return hash.use('argon').verify(hashedValue, plainValue)
      }
      // Default driver (scrypt) — respects `hash.fake()` in tests.
      return hash.verify(hashedValue, plainValue)
    },
  }
}
