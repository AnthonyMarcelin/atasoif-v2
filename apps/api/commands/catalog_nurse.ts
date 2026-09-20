import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import CatalogNurseService, {
  loadEanListFile,
  type NurseRunSummary,
} from '#services/catalog/catalog_nurse_service'

/**
 * Pre-launch catalog nurse (nourrice): curated EANs → cache → OFF → UPCitemdb.
 * Trial UPCitemdb needs no API key; our own daily budget throttles remote calls.
 */
export default class CatalogNurse extends BaseCommand {
  static commandName = 'catalog:nurse'
  static description =
    'Walk a curated EAN list (cache-first, then OFF → UPCitemdb) with a daily remote budget'

  static help = [
    'Default list: resources/catalog/ean-nurse.txt (REAL vs PLACEHOLDER sections).',
    'Lookup order matches live barcode API: local DB → Open Food Facts → UPCitemdb.',
    'Trial endpoint needs no key (UPCITEMDB_USER_KEY empty). Paid key is optional later.',
    '',
    'Examples:',
    '  {{ binaryName }} catalog:nurse --dry-run',
    '  {{ binaryName }} catalog:nurse --daily-limit=100 --delay-ms=1500',
    '  {{ binaryName }} catalog:nurse --file=./resources/catalog/ean-nurse.txt --limit=20',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Path to curated EAN list (default: resources/catalog/ean-nurse.txt)',
  })
  declare file?: string

  @flags.string({
    description: 'Resume state JSON path (default: tmp/catalog-nurse-state.json)',
  })
  declare state?: string

  @flags.boolean({
    description: 'Plan only: cache checks, no provider calls, no upserts, no state write',
    default: false,
  })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Re-process barcodes already marked completed in the state file',
    default: false,
  })
  declare force: boolean

  @flags.number({
    description: 'Max remote lookups this run toward the daily budget (default env or 100)',
  })
  declare dailyLimit?: number

  @flags.number({
    description: 'Max barcodes to process this run (after resume skips)',
  })
  declare limit?: number

  @flags.number({
    description: 'Delay in ms between remote lookups (default 1500)',
    default: 1500,
  })
  declare delayMs: number

  async run() {
    const listPath = this.file
      ? this.resolvePath(this.file)
      : join(app.makePath('resources/catalog'), 'ean-nurse.txt')
    const statePath = this.state
      ? this.resolvePath(this.state)
      : join(app.tmpPath(), 'catalog-nurse-state.json')

    const dailyLimit =
      this.dailyLimit ??
      env.get('CATALOG_NURSE_DAILY_LIMIT') ??
      100

    this.logger.info(`EAN list: ${listPath}`)
    this.logger.info(`State file: ${statePath}`)
    this.logger.info(
      `Mode: ${this.dryRun ? 'dry-run' : 'persist'} · dailyLimit=${dailyLimit} · delayMs=${this.delayMs}`
    )
    this.logger.info(
      'UPCitemdb trial: no API key required (leave UPCITEMDB_USER_KEY empty). Paid key optional for higher quota.'
    )

    const entries = await loadEanListFile(listPath)
    const realCount = entries.filter((e) => e.kind === 'real').length
    const placeholderCount = entries.filter((e) => e.kind === 'placeholder').length
    this.logger.info(
      `Loaded ${entries.length} EAN(s) (${realCount} real, ${placeholderCount} placeholder, ${entries.length - realCount - placeholderCount} unmarked)`
    )

    const nurse = new CatalogNurseService()
    const summary = await nurse.run({
      entries,
      statePath,
      dailyLimit,
      dryRun: this.dryRun,
      force: this.force,
      limit: this.limit,
      delayMs: this.delayMs,
    })

    this.printOutcomes(summary)
    this.printSummary(summary)

    if (summary.stoppedForBudget) {
      this.logger.warning(
        'Stopped: daily remote budget reached. Re-run tomorrow (resume skips completed EANs).'
      )
    }
  }

  private resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return path
    }
    return join(process.cwd(), path)
  }

  private printOutcomes(summary: NurseRunSummary) {
    for (const outcome of summary.outcomes) {
      const tag = `[${outcome.status}] ${outcome.barcode} (${outcome.kind})`
      if (outcome.status === 'miss' || outcome.status === 'invalid') {
        this.logger.warning(`${tag} · ${outcome.message}`)
      } else if (outcome.status.startsWith('skipped') || outcome.status.startsWith('dry_run')) {
        this.logger.info(`${tag} · ${outcome.message}`)
      } else {
        this.logger.success(
          `${tag} · ${outcome.message}${outcome.bottleId ? ` · bottle#${outcome.bottleId}` : ''}`
        )
      }
    }
  }

  private printSummary(summary: NurseRunSummary) {
    this.logger.info(
      [
        `processed=${summary.processed}`,
        `cacheHits=${summary.cacheHits}`,
        `remoteCalls=${summary.remoteCalls}`,
        `upserts=${summary.upserts}`,
        `misses=${summary.misses}`,
        `skipped=${summary.skipped}`,
      ].join(' · ')
    )
  }
}
