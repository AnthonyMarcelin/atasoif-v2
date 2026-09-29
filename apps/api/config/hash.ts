import { defineConfig, drivers } from '@adonisjs/core/hash'

/**
 * Hashing configuration.
 *
 * Default: scrypt for new signups (Node crypto, no native addon).
 * Argon2: verify-only path for Railway v1 `$argon2id$` password hashes (E2-T11).
 */
const hashConfig = defineConfig({
  /**
   * Default hasher used by the application.
   */
  default: 'scrypt',

  list: {
    /**
     * Scrypt is memory-hard, which makes brute-force attacks more expensive.
     */
    scrypt: drivers.scrypt({
      /**
       * Work factor (Node alias: N / cost).
       * Higher values increase security and CPU+memory usage.
       *
       * Tuning guideline:
       * - Start with 16384.
       * - Increase gradually (for example 32768) and benchmark login/signup latency.
       * - Keep values practical for your slowest production machine.
       *
       * Node constraint: value must be a power of two greater than 1.
       */
      cost: 16384,

      /**
       * Block size (Node alias: r / blockSize).
       * Increases memory and CPU linearly.
       *
       * Tuning guideline:
       * - Keep 8 unless you have a measured reason to change it.
       * - Raise only with benchmark data, because memory usage grows quickly.
       */
      blockSize: 8,

      /**
       * Parallelization (Node alias: p / parallelization).
       * Controls how many independent computations are performed.
       *
       * Tuning guideline:
       * - Keep 1 for most applications.
       * - Increase only after load testing if your infrastructure benefits from it.
       */
      parallelization: 1,

      /**
       * Maximum memory limit in bytes (Node alias: maxmem / maxMemory).
       * Hashing throws if the estimated memory usage is above this limit.
       * Node documents the check as approximately: 128 * N * r > maxmem.
       *
       * Tuning guideline:
       * - Keep this aligned with your cost/blockSize choices.
       * - Increase carefully on memory-constrained environments.
       */
      maxMemory: 33554432,
    }),

    /**
     * Argon2id for verifying Railway v1 password hashes (`$argon2id$…`).
     * Requires the optional `argon2` peer dependency.
     * Do not switch `default` to argon — new accounts stay on scrypt.
     */
    argon: drivers.argon2({
      version: 0x13,
      variant: 'id',
      iterations: 3,
      memory: 65536,
      parallelism: 4,
      saltSize: 16,
      hashLength: 32,
    }),
  },
})

export default hashConfig

/**
 * Inferring types for the list of hashers you have configured
 * in the application.
 */
declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
