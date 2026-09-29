import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import V1MigrationService from '#services/v1_migration/v1_migration_service'

/**
 * One-shot Railway v1 → Adonis v2 cellar + users migration (E2-T11).
 * Password hashes are read live from Railway (`DATABASE_PUBLIC_URL`) — never from git.
 */
export default class MigrateV1 extends BaseCommand {
  static commandName = 'migrate:v1'
  static description =
    'Import Railway v1 users (argon2id passwords) + bottles into Lucid with legacy_v1 premium'

  static help = [
    'Requires DATABASE_PUBLIC_URL (Railway Postgres public URL) for password hashes.',
    'Optional --from points at a sanitized JSON export dir (users.json, whisky.json, …).',
    'Without --from, users and bottles are loaded entirely from Railway.',
    '',
    'Examples:',
    '  {{ binaryName }} migrate:v1 --dry-run',
    '  {{ binaryName }} migrate:v1 --from=/var/lib/atasoif/v1-export',
    '  {{ binaryName }} migrate:v1 --database-url="$DATABASE_PUBLIC_URL"',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: 'Parse and plan only — no DB writes',
    default: false,
  })
  declare dryRun: boolean

  @flags.string({
    description: 'Path to sanitized v1 JSON export directory (no password hashes)',
  })
  declare from?: string

  @flags.string({
    description: 'Railway v1 Postgres URL (defaults to env DATABASE_PUBLIC_URL). Never logged.',
  })
  declare databaseUrl?: string

  async run() {
    const databaseUrl = this.databaseUrl?.trim() || process.env.DATABASE_PUBLIC_URL?.trim()
    if (!databaseUrl) {
      this.logger.error(
        'DATABASE_PUBLIC_URL is required (or pass --database-url). Password hashes are not in JSON exports.'
      )
      this.exitCode = 1
      return
    }

    this.logger.info(
      this.dryRun
        ? 'Dry-run: no writes. Loading v1 source…'
        : 'Migrating v1 users + cellar (idempotent)…'
    )

    try {
      const summary = await new V1MigrationService().run({
        dryRun: this.dryRun,
        exportDir: this.from,
        databaseUrl,
        logger: {
          info: (message) => this.logger.info(message),
          warning: (message) => this.logger.warning(message),
        },
      })

      this.logger.info(
        [
          `users: created=${summary.users.created} existing=${summary.users.skippedExisting} duplicate_skipped=${summary.users.skippedDuplicate}`,
          `catalog: created=${summary.bottles.catalogCreated} matched=${summary.bottles.catalogMatched}`,
          `user_bottles: created=${summary.bottles.userBottlesCreated} skipped=${summary.bottles.userBottlesSkipped}`,
          `subscriptions(legacy_v1): upserted=${summary.subscriptions.upserted}`,
          summary.dryRun ? '(dry-run)' : '(committed)',
        ].join(' · ')
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Never echo connection strings / hashes if they appear in nested errors.
      this.logger.error(sanitizeErrorMessage(message))
      this.exitCode = 1
    }
  }
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://***')
    .replace(/\$argon2[^\s]+/gi, '$argon2***')
}
