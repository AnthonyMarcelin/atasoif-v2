import Bottle from '#models/bottle'
import CatalogImageMirror from '#services/catalog/catalog_image_mirror'
import { isHttpPhotoUrl, isOffCatalogPhotoUrl, OFF_CATALOG_MEDIA_PREFIX } from '#services/photo_url'

export type CatalogMirrorRunOptions = {
  dryRun: boolean
  /** Max bottles to attempt (pilot batches). */
  limit?: number
  /** Skip bottles already mirrored (default true). */
  skipMirrored?: boolean
  imageMirror: CatalogImageMirror
  onProgress?: (summary: CatalogMirrorSummary) => void
  progressEvery?: number
  /**
   * Called for the first few mirror failures (rate-limited) so Ace/ops can see
   * the real cause instead of only mirrorErrors=N.
   */
  onMirrorError?: (message: string, context: { barcode: string; remoteUrl: string }) => void
  /** Max onMirrorError invocations per run (default 3). */
  maxLoggedErrors?: number
}

export type CatalogMirrorSummary = {
  scanned: number
  eligible: number
  skippedMirrored: number
  skippedNoRemote: number
  mirrored: number
  mirrorErrors: number
  updated: number
  dryRun: boolean
  stoppedForLimit: boolean
  /** First mirror failure message (if any), for final Ace log line. */
  firstMirrorError: string | null
}

type BottleAttrs = Record<string, unknown> & {
  offImageUrl?: string | null
  mirroredLocalPath?: string | null
}

/**
 * Mirror remote catalog photoUrl (OFF CDN, etc.) onto local disk and rewrite
 * Bottle.photoUrl to `/api/v1/media/off/{barcode}.ext`. Idempotent resume.
 */
export default class CatalogMirrorService {
  async run(options: CatalogMirrorRunOptions): Promise<CatalogMirrorSummary> {
    const skipMirrored = options.skipMirrored ?? true
    const progressEvery = options.progressEvery ?? 50
    const maxLoggedErrors = options.maxLoggedErrors ?? 3
    const logState = { count: 0 }
    const summary: CatalogMirrorSummary = {
      scanned: 0,
      eligible: 0,
      skippedMirrored: 0,
      skippedNoRemote: 0,
      mirrored: 0,
      mirrorErrors: 0,
      updated: 0,
      dryRun: options.dryRun,
      stoppedForLimit: false,
      firstMirrorError: null,
    }

    const query = Bottle.query().whereNull('deleted_at').orderBy('id', 'asc')
    const bottles = await query

    for (const bottle of bottles) {
      summary.scanned += 1

      if (skipMirrored && bottle.photoUrl && isOffCatalogPhotoUrl(bottle.photoUrl)) {
        summary.skippedMirrored += 1
        continue
      }

      const remoteUrl = resolveRemotePhotoUrl(bottle)
      if (!remoteUrl) {
        summary.skippedNoRemote += 1
        continue
      }

      if (!bottle.barcode) {
        summary.skippedNoRemote += 1
        continue
      }

      summary.eligible += 1

      if (options.limit !== undefined && summary.eligible > options.limit) {
        summary.eligible -= 1
        summary.stoppedForLimit = true
        break
      }

      try {
        const result = await options.imageMirror.mirrorFrontImage(remoteUrl, bottle.barcode)
        if (!result) {
          recordMirrorError(summary, options, logState, maxLoggedErrors, {
            message: `mirror returned null for ${remoteUrl}`,
            barcode: bottle.barcode,
            remoteUrl,
          })
        } else {
          summary.mirrored += 1
          if (!options.dryRun) {
            const attrs = { ...(bottle.attrs as BottleAttrs) }
            attrs.offImageUrl = attrs.offImageUrl ?? remoteUrl
            attrs.mirroredLocalPath = result.localPath
            bottle.photoUrl = result.photoUrl
            bottle.attrs = attrs
            await bottle.save()
            summary.updated += 1
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        recordMirrorError(summary, options, logState, maxLoggedErrors, {
          message,
          barcode: bottle.barcode,
          remoteUrl,
        })
      }

      if (options.onProgress && summary.eligible % progressEvery === 0) {
        options.onProgress({ ...summary })
      }
    }

    return summary
  }
}

function recordMirrorError(
  summary: CatalogMirrorSummary,
  options: CatalogMirrorRunOptions,
  logState: { count: number },
  maxLoggedErrors: number,
  detail: { message: string; barcode: string; remoteUrl: string }
): void {
  summary.mirrorErrors += 1
  if (!summary.firstMirrorError) {
    summary.firstMirrorError = detail.message
  }
  if (options.onMirrorError && logState.count < maxLoggedErrors) {
    options.onMirrorError(detail.message, {
      barcode: detail.barcode,
      remoteUrl: detail.remoteUrl,
    })
    logState.count += 1
  }
}

export function resolveRemotePhotoUrl(bottle: Bottle): string | null {
  const current = bottle.photoUrl?.trim() || null
  if (current && isHttpPhotoUrl(current)) {
    return current
  }
  const attrs = bottle.attrs as BottleAttrs | null
  const off = attrs?.offImageUrl?.trim() || null
  if (off && isHttpPhotoUrl(off)) {
    return off
  }
  return null
}

export function defaultOffPublicBaseUrl(configured?: string | null): string {
  const trimmed = configured?.trim()
  if (trimmed) {
    return trimmed.replace(/\/+$/, '')
  }
  return OFF_CATALOG_MEDIA_PREFIX.replace(/\/+$/, '')
}
