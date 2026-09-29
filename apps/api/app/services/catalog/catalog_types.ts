import type { AlcoholCategory, BottleSourceName } from '@atasoif/shared'

/**
 * Normalized product payload shared by OFF / UPCitemdb mappers before upsert.
 */
export type CatalogProductDraft = {
  name: string
  brand: string | null
  origin: string | null
  abv: number | null
  volumeMl: number | null
  barcode: string
  photoUrl: string | null
  categorySlug: AlcoholCategory
  attrs: Record<string, unknown>
  source: BottleSourceName
  externalId: string
  raw: unknown
}

export type CatalogLookupOrigin = 'cache' | 'openfoodfacts' | 'upcitemdb'
