import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/queue'

/**
 * Experimental `@adonisjs/queue` — pin the version in package.json.
 * Default `sync` keeps a single API process working; set `database` + `queue:work`
 * in production when you want large photo jobs off the HTTP thread.
 */
export default defineConfig({
  default: (() => {
    const driver = env.get('QUEUE_DRIVER')?.trim() || 'sync'
    return driver === 'database' ? 'database' : 'sync'
  })(),

  adapters: {
    database: drivers.database({
      connectionName: 'postgres',
    }),
    sync: drivers.sync(),
  },

  worker: {
    concurrency: 2,
    idleDelay: '2s',
  },

  locations: ['./app/jobs/**/*.{ts,js}'],
})
