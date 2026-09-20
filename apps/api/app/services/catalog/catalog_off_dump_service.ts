import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import { normalizeBarcode } from '#services/catalog/catalog_lookup_service'
import CatalogLookupService from '#services/catalog/catalog_lookup_service'
import {
  isAlcoholicOffProduct,
  type OffDumpProductLike,
} from '#services/catalog/off_alcohol_filter'
import { mapOffProductToDraft } from '#services/catalog/off_product_mapper'

export type OffDumpImportOptions = {
  filePath: string
  dryRun: boolean
  limit?: number
  skipLines?: number
  batchLogEvery?: number
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
  upserted: number
  dryRun: boolean
  stoppedForLimit: boolean
}

/**
 * Stream an OFF JSONL dump (plain or .gz), keep alcoholic beverages, upsert bottles.
 * Designed for VPS one-shot runs — not CI (full dump is multi-GB).
 */
export default class CatalogOffDumpService {
  async importFile(options: OffDumpImportOptions): Promise<OffDumpImportSummary> {
    const lookup = options.lookup ?? new CatalogLookupService()
    const batchLogEvery = options.batchLogEvery ?? 5_000
    const summary: OffDumpImportSummary = {
      linesRead: 0,
      jsonErrors: 0,
      nonAlcohol: 0,
      missingIdentity: 0,
      invalidBarcode: 0,
      drafted: 0,
      upserted: 0,
      dryRun: options.dryRun,
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

      if (!isAlcoholicOffProduct(product)) {
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

      // Keep barcode normalized for upsert / uniqueness.
      draft.barcode = normalized
      draft.externalId = normalized
      summary.drafted += 1

      if (!options.dryRun) {
        await lookup.persistDraft(draft)
        summary.upserted += 1
      }

      if (options.onProgress && summary.linesRead % batchLogEvery === 0) {
        options.onProgress({ ...summary })
      }

      if (options.limit !== undefined && summary.drafted >= options.limit) {
        summary.stoppedForLimit = true
        break
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
