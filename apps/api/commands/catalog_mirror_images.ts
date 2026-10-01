import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import CatalogImageMirror from '#services/catalog/catalog_image_mirror'
import CatalogMirrorService, {
  defaultOffPublicBaseUrl,
} from '#services/catalog/catalog_mirror_service'
import { OFF_ATTRIBUTION_EN } from '#services/catalog/catalog_attribution'

/**
 * Mirror remote Bottle.photoUrl (OFF CDN) onto CATALOG_IMAGE_STORAGE_PATH and
 * rewrite photoUrl to `/api/v1/media/off/{barcode}.ext`. Prefer this over
 * re-running catalog:off-dump when bottles are already in Postgres.
 */
export default class CatalogMirrorImages extends BaseCommand {
  static commandName = 'catalog:mirror-images'
  static description =
    'Download remote catalog front images to local disk and update Bottle.photoUrl (no OFF CDN hotlink)'

  static help = [
    'Requires CATALOG_IMAGE_STORAGE_PATH (persistent Docker volume in prod).',
    'Default public path: /api/v1/media/off/{barcode}.ext (auth media route).',
    '',
    'Examples:',
    '  {{ binaryName }} catalog:mirror-images --dry-run --limit=20',
    '  {{ binaryName }} catalog:mirror-images --limit=200',
    '  {{ binaryName }} catalog:mirror-images',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: 'Download + count only — do not update Bottle.photoUrl',
    default: false,
  })
  declare dryRun: boolean

  @flags.number({
    description: 'Max bottles to mirror this run (pilot / resume batches)',
  })
  declare limit?: number

  @flags.number({
    description: 'Log progress every N eligible bottles (default 50)',
    default: 50,
  })
  declare progressEvery: number

  async run() {
    const storageRoot = env.get('CATALOG_IMAGE_STORAGE_PATH')?.trim()
    if (!storageRoot) {
      this.logger.error(
        'CATALOG_IMAGE_STORAGE_PATH is required (e.g. /var/lib/atasoif/catalog-images).'
      )
      this.exitCode = 1
      return
    }

    const publicBaseUrl = defaultOffPublicBaseUrl(env.get('CATALOG_IMAGE_PUBLIC_BASE_URL'))
    const userAgent = env.get('OFF_USER_AGENT')

    const imageMirror = new CatalogImageMirror({
      storageRoot,
      userAgent,
      publicBaseUrl,
    })
    await imageMirror.assertStorageWritable()

    this.logger.info(`Image mirror root: ${storageRoot}`)
    this.logger.info(`Public base: ${publicBaseUrl}`)
    this.logger.info(
      `Mode: ${this.dryRun ? 'dry-run' : 'persist'} · limit=${this.limit ?? 'none'}`
    )
    this.logger.info(OFF_ATTRIBUTION_EN)

    const service = new CatalogMirrorService()
    const summary = await service.run({
      dryRun: this.dryRun,
      limit: this.limit,
      imageMirror,
      progressEvery: this.progressEvery,
      onProgress: (progress) => {
        this.logger.info(
          `progress scanned=${progress.scanned} eligible=${progress.eligible} mirrored=${progress.mirrored} errors=${progress.mirrorErrors} updated=${progress.updated}`
        )
      },
    })

    this.logger.info(
      [
        `scanned=${summary.scanned}`,
        `eligible=${summary.eligible}`,
        `skippedMirrored=${summary.skippedMirrored}`,
        `skippedNoRemote=${summary.skippedNoRemote}`,
        `mirrored=${summary.mirrored}`,
        `mirrorErrors=${summary.mirrorErrors}`,
        `updated=${summary.updated}`,
      ].join(' · ')
    )

    if (summary.stoppedForLimit) {
      this.logger.warning(`Stopped early: --limit=${this.limit} eligible bottles reached.`)
    }

    if (!this.dryRun) {
      this.logger.success('Catalog image mirror finished (resume-safe; re-run skips mirrored).')
    } else {
      this.logger.success('Dry-run finished — re-run without --dry-run to update photoUrl.')
    }
  }
}
