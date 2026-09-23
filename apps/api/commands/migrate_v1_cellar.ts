import { resolve } from 'node:path'
import app from '@adonisjs/core/services/app'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import V1CellarMigrateService, {
  fetchV1PasswordsByUserId,
  loadV1ExportDirectory,
  type V1MigrateSummary,
} from '#services/migrate/v1_cellar_migrate_service'

/**
 * E2-T11 — one-shot import of Railway v1 users + cellars into Adonis v2.
 *
 * Reads sanitized JSON under resources/migrate/v1 (or --from).
 * Password hashes ($argon2id$) are pulled live from DATABASE_PUBLIC_URL
 * and never written into the export files.
 */
export default class MigrateV1Cellar extends BaseCommand {
  static commandName = 'migrate:v1-cellar'
  static description =
    'Import Railway v1 users (argon2id passwords) + bottles into Lucid with legacy premium'

  static help = [
    'Prerequisites: categories seeded (whisky, beer, rhum).',
    'Passwords: set DATABASE_PUBLIC_URL (Railway public Postgres) or --v1-database-url.',
    'Never commit password hashes. Sanitized JSON ships without secrets.',
    '',
    'Examples:',
    '  {{ binaryName }} migrate:v1-cellar --dry-run',
    '  {{ binaryName }} migrate:v1-cellar --from=./resources/migrate/v1',
    '  {{ binaryName }} migrate:v1-cellar --v1-database-url="$DATABASE_PUBLIC_URL"',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Directory with users.json / whisky.json / beer.json / rhum.json',
  })
  declare from?: string

  @flags.string({
    description: 'Railway v1 public Postgres URL (defaults to DATABASE_PUBLIC_URL env)',
  })
  declare v1DatabaseUrl?: string

  @flags.boolean({
    description: 'Plan only — no writes',
    default: false,
  })
  declare dryRun: boolean

  async run() {
    const dir = this.from
      ? resolve(this.from)
      : app.makePath('resources/migrate/v1')

    const databaseUrl = this.v1DatabaseUrl || process.env.DATABASE_PUBLIC_URL

    this.logger.info(`Export dir: ${dir}`)
    this.logger.info(`Mode: ${this.dryRun ? 'dry-run' : 'persist'}`)

    const payload = await loadV1ExportDirectory(dir)
    this.logger.info(
      `Loaded users=${payload.users.length} whisky=${payload.whisky.length} beer=${payload.beer.length} rhum=${payload.rhum.length}`
    )

    if (!databaseUrl) {
      this.logger.error(
        'Missing DATABASE_PUBLIC_URL (or --v1-database-url). Needed to fetch argon2id password hashes (read-only).'
      )
      this.exitCode = 1
      return
    }

    this.logger.info('Fetching password hashes from v1 (read-only, hashes not logged)…')
    const passwords = await fetchV1PasswordsByUserId(databaseUrl)
    let attached = 0
    for (const user of payload.users) {
      const hash = passwords.get(user.id)
      if (hash) {
        user.password = hash
        attached++
      }
    }
    this.logger.info(`Attached password hashes for ${attached}/${payload.users.length} user(s)`)

    const service = new V1CellarMigrateService()
    const summary = await service.run({ payload, dryRun: this.dryRun })
    this.printSummary(summary)

    if (summary.usersMissingPassword > 0) {
      this.logger.warning(
        `${summary.usersMissingPassword} user(s) skipped (missing/invalid argon2 password hash)`
      )
    }

    if (!this.dryRun) {
      this.logger.success('v1 cellar migration finished (idempotent on bottle_sources.external_id).')
    }
  }

  private printSummary(summary: V1MigrateSummary) {
    this.logger.info(
      [
        `users: created=${summary.usersCreated} existing=${summary.usersExisting} dupEmailSkipped=${summary.usersSkippedDuplicateEmail} missingPassword=${summary.usersMissingPassword}`,
        `subscriptions upserted=${summary.subscriptionsUpserted}`,
        `bottles: created=${summary.bottlesCreated} reused=${summary.bottlesReused}`,
        `user_bottles: created=${summary.userBottlesCreated} skipped=${summary.userBottlesSkipped}`,
      ].join(' · ')
    )
  }
}
