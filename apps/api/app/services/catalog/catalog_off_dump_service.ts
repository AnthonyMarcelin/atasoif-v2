import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import { normalizeBarcode } from '#services/catalog/catalog_lookup_service'
import CatalogLookupService from '#services/catalog/catalog_lookup_service'
import { CatalogDedupeBuffer } from '#services/catalog/catalog_dedupe'
import CatalogImageMirror from '#services/catalog/catalog_image_mirror'
import {
  isAlcoholicOffProduct,
  type OffDumpFilterProfile,
  type OffDumpProductLike,
} from '#services/catalog/off_alcohol_filter'
import { mapOffProductToDraft } from '#services/catalog/off_product_mapper'
import type { CatalogProductDraft } from '#services/catalog/catalog_types'

export type OffDumpImportOptions = {
  filePath: string
  dryRun: boolean
  limit?: number
  skipLines?: number
  batchLogEvery?: number
  /** curated = whiskies/rums/gins/vodkas/beers (+ parents); full = broader alcohol */
  profile?: OffDumpFilterProfile
  /** Collapse 70cl / 1L / packs on normalized brand+name (default true). */
  dedupe?: boolean
  /** Download front images to local storage (requires imageMirror). */
  mirrorImages?: boolean
  imageMirror?: CatalogImageMirror | null
  onProgress?: (summary: OffDumpImportSummary) => void
  lookup?: CatalogLookupService
}

export type OffDumpImportSummary = {
  linesRead: number
  jsonErrors: number
  nonAlcohol: number
  missingIdentity: number
  invalidBarcode: number
  drafted: number
  dedupedAway: number
  mirrored: number
  mirrorErrors: number
  upserted: number
  dryRun: boolean
  profile: OffDumpFilterProfile
  dedupe: boolean
  stoppedForLimit: boolean
}

/**
 * Stream an OFF JSONL dump (plain or .gz), keep alcoholic beverages, upsert bottles.
 * Designed for VPS one-shot runs — not CI (full dump is multi-GB).
 * Prefer DuckDB-filtered JSONL from Parquet/CSV when possible (see docs/CATALOG-SEED.md).
 */
export default class CatalogOffDumpService {
  async importFile(options: OffDumpImportOptions): Promise<OffDumpImportSummary> {
    const lookup = options.lookup ?? new CatalogLookupService()
    const batchLogEvery = options.batchLogEvery ?? 5_000
    const profile = options.profile ?? 'curated'
    const dedupe = options.dedupe ?? true
    const mirrorImages = options.mirrorImages ?? false
    const buffer = dedupe ? new CatalogDedupeBuffer() : null
    const immediateDrafts: CatalogProductDraft[] = []

    const summary: OffDumpImportSummary = {
      linesRead: 0,
      jsonErrors: 0,
      nonAlcohol: 0,
      missingIdentity: 0,
      invalidBarcode: 0,
      drafted: 0,
      dedupedAway: 0,
      mirrored: 0,
      mirrorErrors: 0,
      upserted: 0,
      dryRun: options.dryRun,
      profile,
      dedupe,
      stoppedForLimit: false,
    }

    const lineReader = this.openLineReader(options.filePath)
    const skip = options.skipLines ?? 0

    for await (const line of lineReader) {
      summary.linesRead += 1
      if (summary.linesRead <= skip) {
        continue
      }

      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      let product: OffDumpProductLike
      try {
        product = JSON.parse(trimmed) as OffDumpProductLike
      } catch {
        summary.jsonErrors += 1
        continue
      }

      if (!isAlcoholicOffProduct(product, profile)) {
        summary.nonAlcohol += 1
        continue
      }

      const barcodeHint = String(product.code ?? '').trim()
      const normalized = normalizeBarcode(barcodeHint)
      if (!normalized) {
        summary.invalidBarcode += 1
        continue
      }

      const draft = mapOffProductToDraft(normalized, product)
      if (!draft) {
        summary.missingIdentity += 1
        continue
      }

      draft.barcode = normalized
      draft.externalId = normalized

      if (buffer) {
        const result = buffer.offer(draft)
        if (!result.kept) {
          summary.dedupedAway += 1
        } else if (result.replaced) {
          summary.dedupedAway += 1
        }
        summary.drafted = buffer.size
      } else {
        immediateDrafts.push(draft)
        summary.drafted = immediateDrafts.length
      }

      if (options.onProgress && summary.linesRead % batchLogEvery === 0) {
        options.onProgress({ ...summary })
      }

      if (options.limit !== undefined && summary.drafted >= options.limit) {
        summary.stoppedForLimit = true
        break
      }
    }

    const drafts = buffer ? buffer.values() : immediateDrafts
    summary.drafted = drafts.length

    for (const draft of drafts) {
      if (mirrorImages && options.imageMirror && draft.photoUrl) {
        try {
          const mirrored = await options.imageMirror.mirrorFrontImage(draft.photoUrl, draft.barcode)
          if (mirrored) {
            draft.attrs = {
              ...draft.attrs,
              offImageUrl: draft.attrs.offImageUrl ?? draft.photoUrl,
              mirroredLocalPath: mirrored.localPath,
            }
            draft.photoUrl = mirrored.photoUrl
            summary.mirrored += 1
          } else {
            summary.mirrorErrors += 1
          }
        } catch {
          summary.mirrorErrors += 1
        }
      }

      if (!options.dryRun) {
        await lookup.persistDraft(draft)
        summary.upserted += 1
      }
    }

    return summary
  }

  private openLineReader(filePath: string): AsyncIterable<string> {
    const lower = filePath.toLowerCase()
    const fileStream = createReadStream(filePath)
    const input = lower.endsWith('.gz') ? fileStream.pipe(createGunzip()) : fileStream
    return createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })
  }
}
