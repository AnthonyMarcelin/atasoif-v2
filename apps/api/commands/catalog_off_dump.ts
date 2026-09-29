import { join } from 'node:path'
import { access } from 'node:fs/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import { OFF_ATTRIBUTION_EN } from '#services/catalog/catalog_attribution'
import CatalogImageMirror from '#services/catalog/catalog_image_mirror'
import CatalogOffDumpService from '#services/catalog/catalog_off_dump_service'
import type { OffDumpFilterProfile } from '#services/catalog/off_alcohol_filter'

/**
 * Bulk import Open Food Facts dump rows filtered to alcoholic beverages.
 * Download the dump on the VPS first (see docs/CATALOG-SEED.md) — not for CI.
 * Prefer a DuckDB-filtered JSONL from Parquet/CSV when practical.
 */
export default class CatalogOffDump extends BaseCommand {
  static commandName = 'catalog:off-dump'
  static description =
    'Import an OFF JSONL dump (.jsonl or .jsonl.gz), keep alcohol only, upsert Bottle + BottleSource'

  static help = [
    'Primary volume seed for curated whisky / rum / gin / vodka / beer refs.',
    'Complement with catalog:nurse for curated spirits EANs OFF often misses.',
    '',
    'Prefer Parquet (~800MB) + DuckDB filter → JSONL, then this command (docs/CATALOG-SEED.md).',
    '',
    'Examples:',
    '  {{ binaryName }} catalog:off-dump --file=/var/lib/atasoif/off/alcohol.jsonl --dry-run --limit=50',
    '  {{ binaryName }} catalog:off-dump --file=/var/lib/atasoif/off/openfoodfacts-products.jsonl.gz --profile=curated',
    '  {{ binaryName }} catalog:off-dump --file=…jsonl --mirror-images',
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
    description: 'Stop after N unique alcohol products drafted (useful smoke test)',
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

  @flags.string({
    description: 'Filter profile: curated (default) or full',
    default: 'curated',
  })
  declare profile: string

  @flags.boolean({
    description: 'Dedupe on normalized brand+name (default true; pass --no-dedupe to disable)',
    default: true,
  })
  declare dedupe: boolean

  @flags.boolean({
    description: 'Download front images to CATALOG_IMAGE_STORAGE_PATH (no OFF CDN hotlink)',
    default: false,
  })
  declare mirrorImages: boolean

  async run() {
    const filePath = this.resolvePath(this.file)
    await this.assertReadable(filePath)

    const profile = this.resolveProfile(this.profile)
    const storageRoot = env.get('CATALOG_IMAGE_STORAGE_PATH')
    const publicBaseUrl = env.get('CATALOG_IMAGE_PUBLIC_BASE_URL')
    const userAgent = env.get('OFF_USER_AGENT')

    if (this.mirrorImages && !storageRoot) {
      this.logger.error(
        ' --mirror-images requires CATALOG_IMAGE_STORAGE_PATH (e.g. /var/lib/atasoif/catalog-images).'
      )
      this.exitCode = 1
      return
    }

    let imageMirror: CatalogImageMirror | null = null
    if (this.mirrorImages && storageRoot) {
      imageMirror = new CatalogImageMirror({
        storageRoot,
        userAgent,
        publicBaseUrl: publicBaseUrl || null,
      })
      await imageMirror.assertStorageWritable()
      this.logger.info(`Image mirror root: ${storageRoot}`)
    }

    this.logger.info(`OFF dump file: ${filePath}`)
    this.logger.info(
      `Mode: ${this.dryRun ? 'dry-run' : 'persist'} · profile=${profile} · dedupe=${this.dedupe} · mirror=${this.mirrorImages} · limit=${this.limit ?? 'none'} · skipLines=${this.skipLines}`
    )
    this.logger.info(
      profile === 'curated'
        ? 'Filter: curated tags (whiskies, rums, gins, vodkas, beers) + alcoholic-beverages/spirits parents as needed'
        : 'Filter: full alcoholic beverages (incl. wines, liqueurs, ciders, …)'
    )
    this.logger.info(OFF_ATTRIBUTION_EN)

    const service = new CatalogOffDumpService()
    const summary = await service.importFile({
      filePath,
      dryRun: this.dryRun,
      limit: this.limit,
      skipLines: this.skipLines,
      batchLogEvery: this.progressEvery,
      profile,
      dedupe: this.dedupe,
      mirrorImages: this.mirrorImages,
      imageMirror,
      onProgress: (progress) => {
        this.logger.info(
          `progress lines=${progress.linesRead} drafted=${progress.drafted} dedupedAway=${progress.dedupedAway} upserted=${progress.upserted} nonAlcohol=${progress.nonAlcohol}`
        )
      },
    })

    this.logger.info(
      [
        `linesRead=${summary.linesRead}`,
        `drafted=${summary.drafted}`,
        `dedupedAway=${summary.dedupedAway}`,
        `upserted=${summary.upserted}`,
        `mirrored=${summary.mirrored}`,
        `mirrorErrors=${summary.mirrorErrors}`,
        `nonAlcohol=${summary.nonAlcohol}`,
        `invalidBarcode=${summary.invalidBarcode}`,
        `missingIdentity=${summary.missingIdentity}`,
        `jsonErrors=${summary.jsonErrors}`,
      ].join(' · ')
    )

    if (summary.stoppedForLimit) {
      this.logger.warning(`Stopped early: --limit=${this.limit} unique alcohol products reached.`)
    }

    if (!this.dryRun) {
      this.logger.success('OFF alcohol dump import finished (idempotent upsert by barcode / BottleSource).')
    } else {
      this.logger.success('Dry-run finished — re-run without --dry-run to persist.')
    }
  }

  private resolveProfile(raw: string): OffDumpFilterProfile {
    const value = raw.trim().toLowerCase()
    if (value === 'curated' || value === 'full') {
      return value
    }
    this.logger.warning(`Unknown --profile=${raw}; falling back to curated.`)
    return 'curated'
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
      this.logger.info('Download / DuckDB steps: docs/CATALOG-SEED.md (VPS section).')
      this.exitCode = 1
      throw new Error(`OFF dump file missing: ${path}`)
    }
  }
}
