import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import Bottle from '#models/bottle'
import BottleSource from '#models/bottle_source'
import OpenFoodFactsClient from '#services/catalog/open_food_facts_client'
import UpcItemDbClient from '#services/catalog/upcitemdb_client'
import type { CatalogLookupOrigin, CatalogProductDraft } from '#services/catalog/catalog_types'
import { readPostgresUniqueViolation } from '#services/postgres_error'

export type CatalogBarcodeResult = {
  bottle: Bottle
  origin: CatalogLookupOrigin
}

/**
 * Cache-first catalog lookup by EAN/barcode.
 * Local hit → 0 external calls. Miss → OFF then UPCitemdb nurse → upsert.
 */
export default class CatalogLookupService {
  constructor(
    private readonly offClient: OpenFoodFactsClient = new OpenFoodFactsClient(),
    private readonly upcClient: UpcItemDbClient = new UpcItemDbClient()
  ) {}

  async findLocalByBarcode(barcode: string): Promise<Bottle | null> {
    return Bottle.query()
      .where('barcode', barcode)
      .whereNull('deleted_at')
      .preload('category')
      .first()
  }

  async lookupByBarcode(barcode: string): Promise<CatalogBarcodeResult | null> {
    const normalized = normalizeBarcode(barcode)
    if (!normalized) {
      return null
    }

    const cached = await this.findLocalByBarcode(normalized)
    if (cached) {
      return { bottle: cached, origin: 'cache' }
    }

    const offDraft = await this.safeLookup(() => this.offClient.lookupByBarcode(normalized))
    if (offDraft) {
      const bottle = await this.persistDraft(offDraft)
      return { bottle, origin: 'openfoodfacts' }
    }

    const upcDraft = await this.safeLookup(() => this.upcClient.lookupByBarcode(normalized))
    if (upcDraft) {
      const bottle = await this.persistDraft(upcDraft)
      return { bottle, origin: 'upcitemdb' }
    }

    return null
  }

  private async safeLookup(
    run: () => Promise<CatalogProductDraft | null>
  ): Promise<CatalogProductDraft | null> {
    try {
      return await run()
    } catch {
      // Provider outage / rate-limit: treat as miss so callers can fall through or 404 in FR.
      return null
    }
  }

  async persistDraft(draft: CatalogProductDraft): Promise<Bottle> {
    try {
      return await this.writeDraft(draft)
    } catch (error) {
      if (readPostgresUniqueViolation(error) !== 'bottles_barcode_active_unique') {
        throw error
      }
      const existing = await this.findLocalByBarcode(draft.barcode)
      if (!existing) {
        throw error
      }
      return existing
    }
  }

  private async writeDraft(draft: CatalogProductDraft): Promise<Bottle> {
    const category = await Category.findByOrFail('slug', draft.categorySlug)
    const rawHash = hashRaw(draft.raw)

    return db.transaction(async (trx) => {
      let bottle = await Bottle.query({ client: trx })
        .where('barcode', draft.barcode)
        .whereNull('deleted_at')
        .first()

      if (bottle) {
        bottle.useTransaction(trx)
        bottle.merge({
          name: draft.name,
          brand: draft.brand,
          origin: draft.origin,
          abv: draft.abv,
          volumeMl: draft.volumeMl,
          photoUrl: draft.photoUrl ?? bottle.photoUrl,
          attrs: { ...bottle.attrs, ...draft.attrs },
          categoryId: category.id,
        })
        await bottle.save()
      } else {
        bottle = await Bottle.create(
          {
            name: draft.name,
            brand: draft.brand,
            origin: draft.origin,
            abv: draft.abv,
            volumeMl: draft.volumeMl,
            barcode: draft.barcode,
            photoUrl: draft.photoUrl,
            attrs: draft.attrs,
            categoryId: category.id,
          },
          { client: trx }
        )
      }

      await BottleSource.updateOrCreate(
        {
          source: draft.source,
          externalId: draft.externalId,
        },
        {
          bottleId: bottle.id,
          source: draft.source,
          externalId: draft.externalId,
          rawHash,
          lastSyncedAt: DateTime.utc(),
        },
        { client: trx }
      )

      await bottle.load('category')
      return bottle
    })
  }
}

export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 14) {
    return null
  }
  return digits
}

function hashRaw(raw: unknown): string {
  return createHash('sha256').update(JSON.stringify(raw)).digest('hex')
}
