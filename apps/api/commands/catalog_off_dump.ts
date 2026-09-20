import { join } from 'node:path'
import { access } from 'node:fs/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import CatalogOffDumpService from '#services/catalog/catalog_off_dump_service'

/**
 * Bulk import Open Food Facts dump rows filtered to alcoholic beverages.
 * Download the dump on the VPS first (see docs/CATALOG-SEED.md) — not for CI.
 */
export default class CatalogOffDump extends BaseCommand {
  static commandName = 'catalog:off-dump'
  static description =
    'Import an OFF JSONL dump (.jsonl or .jsonl.gz), keep alcohol only, upsert Bottle + BottleSource'

  static help = [
    'Primary volume seed for beer / wine / food-alcohol hits.',
    'Complement with catalog:nurse for curated spirits EANs OFF often misses.',
    '',
    'Download (VPS, outside Ace):',
    '  mkdir -p /var/lib/atasoif/off && cd /var/lib/atasoif/off',
    '  curl -L -o openfoodfacts-products.jsonl.gz \\',
    '    https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz',
    '',
    'Examples:',
    '  {{ binaryName }} catalog:off-dump --file=/var/lib/atasoif/off/openfoodfacts-products.jsonl.gz --dry-run --limit=50',
    '  {{ binaryName }} catalog:off-dump --file=/var/lib/atasoif/off/openfoodfacts-products.jsonl.gz',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Path to OFF JSONL dump (.jsonl or .jsonl.gz)',
    required: true,
  })
  declare file: string

  @flags.boolean({
    description: 'Parse and filter only — no DB upserts',
    default: false,
  })
  declare dryRun: boolean

  @flags.number({
    description: 'Stop after N alcohol products drafted (useful smoke test)',
  })
  declare limit?: number

  @flags.number({
    description: 'Skip the first N lines of the dump (resume aid)',
    default: 0,
  })
  declare skipLines: number

  @flags.number({
    description: 'Log progress every N lines read (default 5000)',
    default: 5_000,
  })
  declare progressEvery: number

  async run() {
    const filePath = this.resolvePath(this.file)
    await this.assertReadable(filePath)

    this.logger.info(`OFF dump file: ${filePath}`)
    this.logger.info(
      `Mode: ${this.dryRun ? 'dry-run' : 'persist'} · limit=${this.limit ?? 'none'} · skipLines=${this.skipLines}`
    )
    this.logger.info(
      'Filter: alcoholic beverages via categories_tags (beers/wines/spirits/…) · excludes non-alcoholic beers'
    )
    this.logger.info(
      'Attribution: Contains data from Open Food Facts, available under the Open Database License (ODbL).'
    )

    const service = new CatalogOffDumpService()
    const summary = await service.importFile({
      filePath,
      dryRun: this.dryRun,
      limit: this.limit,
      skipLines: this.skipLines,
      batchLogEvery: this.progressEvery,
      onProgress: (progress) => {
        this.logger.info(
          `progress lines=${progress.linesRead} drafted=${progress.drafted} upserted=${progress.upserted} nonAlcohol=${progress.nonAlcohol}`
        )
      },
    })

    this.logger.info(
      [
        `linesRead=${summary.linesRead}`,
        `drafted=${summary.drafted}`,
        `upserted=${summary.upserted}`,
        `nonAlcohol=${summary.nonAlcohol}`,
        `invalidBarcode=${summary.invalidBarcode}`,
        `missingIdentity=${summary.missingIdentity}`,
        `jsonErrors=${summary.jsonErrors}`,
      ].join(' · ')
    )

    if (summary.stoppedForLimit) {
      this.logger.warning(`Stopped early: --limit=${this.limit} alcohol products reached.`)
    }

    if (!this.dryRun) {
      this.logger.success('OFF alcohol dump import finished (idempotent upsert by barcode / BottleSource).')
    } else {
      this.logger.success('Dry-run finished — re-run without --dry-run to persist.')
    }
  }

  private resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return path
    }
    return join(process.cwd(), path)
  }

  private async assertReadable(path: string) {
    try {
      await access(path)
    } catch {
      this.logger.error(`File not found or unreadable: ${path}`)
      this.logger.info('Download steps: docs/CATALOG-SEED.md (VPS section).')
      this.exitCode = 1
      throw new Error(`OFF dump file missing: ${path}`)
    }
  }
}
