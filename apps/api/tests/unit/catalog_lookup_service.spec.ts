import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { BOTTLE_SOURCES } from '@atasoif/shared'
import Category from '#models/category'
import Bottle from '#models/bottle'
import BottleSource from '#models/bottle_source'
import CatalogLookupService from '#services/catalog/catalog_lookup_service'
import type { CatalogProductDraft } from '#services/catalog/catalog_types'
import type OpenFoodFactsClient from '#services/catalog/open_food_facts_client'
import type UpcItemDbClient from '#services/catalog/upcitemdb_client'

test.group('CatalogLookupService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function ensureWhiskyCategory() {
    return Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
  }

  function draft(overrides: Partial<CatalogProductDraft> = {}): CatalogProductDraft {
    return {
      name: 'Johnnie Walker Black Label',
      brand: 'Johnnie Walker',
      origin: 'Scotland',
      abv: 40,
      volumeMl: 700,
      barcode: '5000267024202',
      photoUrl: 'https://example.com/jw.jpg',
      categorySlug: 'whisky',
      attrs: { provider: BOTTLE_SOURCES.openfoodfacts },
      source: BOTTLE_SOURCES.openfoodfacts,
      externalId: '5000267024202',
      raw: { status: 1 },
      ...overrides,
    }
  }

  test('returns cached bottle without calling providers', async ({ assert }) => {
    await ensureWhiskyCategory()
    const category = await Category.findByOrFail('slug', 'whisky')
    const bottle = await Bottle.create({
      name: 'Cached Whisky',
      brand: 'Cache',
      barcode: '5000267024202',
      categoryId: category.id,
      attrs: {},
    })

    let offCalls = 0
    let upcCalls = 0
    const service = new CatalogLookupService(
      { lookupByBarcode: async () => {
        offCalls++
        return null
      } } as unknown as OpenFoodFactsClient,
      {
        isEnabled: () => true,
        lookupByBarcode: async () => {
          upcCalls++
          return null
        },
      } as unknown as UpcItemDbClient
    )

    const result = await service.lookupByBarcode('5000267024202')
    assert.isNotNull(result)
    assert.equal(result!.origin, 'cache')
    assert.equal(result!.bottle.id, bottle.id)
    assert.equal(offCalls, 0)
    assert.equal(upcCalls, 0)
  })

  test('persists OFF draft and links BottleSource', async ({ assert }) => {
    await ensureWhiskyCategory()

    const service = new CatalogLookupService(
      {
        lookupByBarcode: async () => draft(),
      } as unknown as OpenFoodFactsClient,
      {
        isEnabled: () => true,
        lookupByBarcode: async () => {
          throw new Error('UPC should not be called')
        },
      } as unknown as UpcItemDbClient
    )

    const result = await service.lookupByBarcode('5000267024202')
    assert.isNotNull(result)
    assert.equal(result!.origin, 'openfoodfacts')
    assert.equal(result!.bottle.name, 'Johnnie Walker Black Label')
    assert.equal(result!.bottle.barcode, '5000267024202')
    assert.equal(Number(result!.bottle.abv), 40)
    assert.equal(result!.bottle.volumeMl, 700)

    const source = await BottleSource.query()
      .where('source', BOTTLE_SOURCES.openfoodfacts)
      .where('external_id', '5000267024202')
      .firstOrFail()
    assert.equal(source.bottleId, result!.bottle.id)
    assert.isString(source.rawHash)
  })

  test('falls back to UPCitemdb when OFF misses', async ({ assert }) => {
    await ensureWhiskyCategory()

    const service = new CatalogLookupService(
      {
        lookupByBarcode: async () => null,
      } as unknown as OpenFoodFactsClient,
      {
        isEnabled: () => true,
        lookupByBarcode: async () =>
          draft({
            name: 'Nurse Whisky',
            source: BOTTLE_SOURCES.upcitemdb,
            attrs: { provider: BOTTLE_SOURCES.upcitemdb },
            raw: { items: [{ title: 'Nurse Whisky' }] },
          }),
      } as unknown as UpcItemDbClient
    )

    const result = await service.lookupByBarcode('5000267024202')
    assert.isNotNull(result)
    assert.equal(result!.origin, 'upcitemdb')
    assert.equal(result!.bottle.name, 'Nurse Whisky')

    const source = await BottleSource.findByOrFail({
      source: BOTTLE_SOURCES.upcitemdb,
      externalId: '5000267024202',
    })
    assert.equal(source.bottleId, result!.bottle.id)
  })

  test('returns null when both providers miss', async ({ assert }) => {
    const service = new CatalogLookupService(
      { lookupByBarcode: async () => null } as unknown as OpenFoodFactsClient,
      {
        isEnabled: () => true,
        lookupByBarcode: async () => null,
      } as unknown as UpcItemDbClient
    )

    const result = await service.lookupByBarcode('0000000000000')
    assert.isNull(result)
  })
})
