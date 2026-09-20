import { test } from '@japa/runner'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { Readable } from 'node:stream'
import { isAlcoholicOffProduct } from '#services/catalog/off_alcohol_filter'
import { mapOffProductToDraft } from '#services/catalog/off_product_mapper'
import { cleanRetailName, normalizeIdentityKey } from '#services/catalog/clean_retail_name'
import { CatalogDedupeBuffer, scoreCatalogDraft } from '#services/catalog/catalog_dedupe'
import CatalogImageMirror from '#services/catalog/catalog_image_mirror'
import CatalogOffDumpService from '#services/catalog/catalog_off_dump_service'
import type CatalogLookupService from '#services/catalog/catalog_lookup_service'
import type { CatalogProductDraft } from '#services/catalog/catalog_types'

test.group('isAlcoholicOffProduct', () => {
  test('curated accepts whiskies / rums / gins / vodkas / beers', ({ assert }) => {
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:beers'] }, 'curated'))
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:whiskies'] }, 'curated'))
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:rums'] }, 'curated'))
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:gins'] }, 'curated'))
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:vodkas'] }, 'curated'))
  })

  test('curated rejects wine-only tags; full accepts them', ({ assert }) => {
    assert.isFalse(isAlcoholicOffProduct({ categories_tags: ['en:wines', 'en:red-wines'] }, 'curated'))
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:wines', 'en:red-wines'] }, 'full'))
  })

  test('curated accepts alcoholic-beverages parent with spirit ABV', ({ assert }) => {
    assert.isTrue(
      isAlcoholicOffProduct(
        { categories_tags: ['en:alcoholic-beverages'], alcohol_100g: 40 },
        'curated'
      )
    )
  })

  test('rejects non-alcoholic beers and soft drinks', ({ assert }) => {
    assert.isFalse(
      isAlcoholicOffProduct(
        {
          categories_tags: ['en:beers', 'en:non-alcoholic-beers'],
          alcohol_100g: 0,
        },
        'curated'
      )
    )
    assert.isFalse(isAlcoholicOffProduct({ categories_tags: ['en:sodas'] }, 'curated'))
    assert.isFalse(isAlcoholicOffProduct({ categories_tags: ['en:waters'] }, 'full'))
  })

  test('full falls back to alcohol_100g when tags are thin', ({ assert }) => {
    assert.isTrue(isAlcoholicOffProduct({ alcohol_100g: 40 }, 'full'))
    assert.isFalse(isAlcoholicOffProduct({ alcohol_100g: 0 }, 'full'))
    assert.isFalse(isAlcoholicOffProduct({}, 'full'))
    assert.isFalse(isAlcoholicOffProduct({ alcohol_100g: 40 }, 'curated'))
  })
})

test.group('cleanRetailName / identity', () => {
  test('strips pack and volume noise', ({ assert }) => {
    assert.equal(cleanRetailName('Johnnie Walker Black Label 70 cl'), 'Johnnie Walker Black Label')
    assert.equal(cleanRetailName('Heineken pack de 6 x 33cl'), 'Heineken')
    assert.equal(cleanRetailName('Pastis 51 promo 12,50€'), 'Pastis 51')
  })

  test('collapses brand+name variants for dedupe key', ({ assert }) => {
    const a = normalizeIdentityKey('Johnnie Walker', 'Johnnie Walker Black Label 70 cl')
    const b = normalizeIdentityKey('Johnnie Walker', 'Black Label 1L')
    const c = normalizeIdentityKey('Johnnie Walker', 'Black Label pack de 2')
    assert.equal(a, b)
    assert.equal(b, c)
  })
})

test.group('CatalogDedupeBuffer', () => {
  test('keeps preferred volume with photo', ({ assert }) => {
    const buffer = new CatalogDedupeBuffer()
    const weak: CatalogProductDraft = {
      name: 'Black Label',
      brand: 'Johnnie Walker',
      origin: null,
      abv: 40,
      volumeMl: 1000,
      barcode: '111',
      photoUrl: null,
      categorySlug: 'whisky',
      attrs: {},
      source: 'openfoodfacts',
      externalId: '111',
      raw: {},
    }
    const strong: CatalogProductDraft = {
      ...weak,
      volumeMl: 700,
      barcode: '222',
      photoUrl: 'https://example.com/jw.jpg',
      externalId: '222',
    }

    buffer.offer(weak)
    const second = buffer.offer(strong)
    assert.isTrue(second.kept)
    assert.isTrue(second.replaced)
    assert.equal(buffer.values()[0]!.barcode, '222')
    assert.isTrue(scoreCatalogDraft(strong) > scoreCatalogDraft(weak))
  })
})

test.group('mapOffProductToDraft', () => {
  test('maps FR name, cleans volume, keeps offImageUrl', ({ assert }) => {
    const draft = mapOffProductToDraft('5000267024202', {
      code: '5000267024202',
      product_name_fr: 'Johnnie Walker Black Label 70 cl',
      brands: 'Johnnie Walker, Diageo',
      quantity: '70 cl',
      categories_tags: ['en:whiskies'],
      alcohol_100g: 40,
      image_front_url: 'https://images.openfoodfacts.org/jw.jpg',
    })
    assert.isNotNull(draft)
    assert.equal(draft!.name, 'Black Label')
    assert.equal(draft!.brand, 'Johnnie Walker')
    assert.equal(draft!.volumeMl, 700)
    assert.equal(draft!.categorySlug, 'whisky')
    assert.equal(draft!.abv, 40)
    assert.equal(draft!.photoUrl, 'https://images.openfoodfacts.org/jw.jpg')
    assert.equal(draft!.attrs.offImageUrl, 'https://images.openfoodfacts.org/jw.jpg')
  })
})

test.group('CatalogImageMirror', () => {
  test('writes front image to storage root', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'off-img-'))
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    const mirror = new CatalogImageMirror({
      storageRoot: dir,
      userAgent: 'AtasoifTest/0.1',
      publicBaseUrl: 'https://api.example/media/catalog',
      fetchImpl: async () =>
        new Response(Readable.toWeb(Readable.from(bytes)) as BodyInit, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
    })

    const result = await mirror.mirrorFrontImage('https://images.example/front.jpg', '5000267024202')
    assert.isNotNull(result)
    assert.equal(result!.photoUrl, 'https://api.example/media/catalog/5000267024202.jpg')
    const written = await readFile(result!.localPath)
    assert.deepEqual(written, bytes)
  })
})

test.group('CatalogOffDumpService', () => {
  test('filters curated alcohol lines from a JSONL fixture (dry-run)', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'off-dump-'))
    const filePath = join(dir, 'sample.jsonl')
    const lines = [
      JSON.stringify({
        code: '1111111111111',
        product_name: 'Cola',
        categories_tags: ['en:sodas'],
      }),
      JSON.stringify({
        code: '5000267024202',
        product_name: 'Johnnie Walker Black Label',
        brands: 'Johnnie Walker',
        categories_tags: ['en:whiskies'],
        alcohol_100g: 40,
        quantity: '70 cl',
      }),
      JSON.stringify({
        code: '3080216055756',
        product_name: 'Beer 0.0',
        categories_tags: ['en:beers', 'en:non-alcoholic-beers'],
        alcohol_100g: 0,
      }),
      JSON.stringify({
        code: '3010000000001',
        product_name: 'Bordeaux rouge',
        categories_tags: ['en:wines'],
        alcohol_100g: 13,
      }),
      'not-json',
    ]
    await writeFile(filePath, `${lines.join('\n')}\n`, 'utf8')

    let persistCalls = 0
    const lookup = {
      persistDraft: async (_draft: CatalogProductDraft) => {
        persistCalls += 1
        return {} as never
      },
    } as unknown as CatalogLookupService

    const service = new CatalogOffDumpService()
    const summary = await service.importFile({
      filePath,
      dryRun: true,
      dedupe: false,
      lookup,
    })

    assert.equal(summary.drafted, 1)
    assert.equal(summary.upserted, 0)
    assert.equal(summary.nonAlcohol, 3)
    assert.equal(summary.jsonErrors, 1)
    assert.equal(persistCalls, 0)
  })

  test('dedupes brand+name volume variants', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'off-dump-dedupe-'))
    const filePath = join(dir, 'sample.jsonl')
    const rows = [
      {
        code: '5000267024202',
        product_name: 'Black Label 70 cl',
        brands: 'Johnnie Walker',
        categories_tags: ['en:whiskies'],
        alcohol_100g: 40,
        quantity: '70 cl',
        image_front_url: 'https://example.com/jw.jpg',
      },
      {
        code: '5000267024999',
        product_name: 'Black Label 1L',
        brands: 'Johnnie Walker',
        categories_tags: ['en:whiskies'],
        alcohol_100g: 40,
        quantity: '1 l',
      },
    ]
    await writeFile(filePath, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8')

    const persisted: CatalogProductDraft[] = []
    const service = new CatalogOffDumpService()
    const summary = await service.importFile({
      filePath,
      dryRun: false,
      dedupe: true,
      lookup: {
        persistDraft: async (draft: CatalogProductDraft) => {
          persisted.push(draft)
          return {} as never
        },
      } as unknown as CatalogLookupService,
    })

    assert.equal(summary.drafted, 1)
    assert.equal(summary.dedupedAway, 1)
    assert.equal(summary.upserted, 1)
    assert.equal(persisted[0]!.barcode, '5000267024202')
  })

  test('reads gzip JSONL and upserts when not dry-run', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'off-dump-gz-'))
    const filePath = join(dir, 'sample.jsonl.gz')
    const row = JSON.stringify({
      code: '3119780259625',
      product_name_fr: 'Heineken',
      brands: 'Heineken',
      categories_tags: ['en:beers'],
      alcohol_100g: 5,
      quantity: '33 cl',
    })
    await writeFile(filePath, gzipSync(`${row}\n`))

    const persisted: CatalogProductDraft[] = []
    const lookup = {
      persistDraft: async (draft: CatalogProductDraft) => {
        persisted.push(draft)
        return {} as never
      },
    } as unknown as CatalogLookupService

    const service = new CatalogOffDumpService()
    const summary = await service.importFile({
      filePath,
      dryRun: false,
      dedupe: false,
      lookup,
    })

    assert.equal(summary.drafted, 1)
    assert.equal(summary.upserted, 1)
    assert.equal(persisted[0]!.barcode, '3119780259625')
    assert.equal(persisted[0]!.categorySlug, 'beer')
  })

  test('honours --limit on drafted alcohol products', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'off-dump-limit-'))
    const filePath = join(dir, 'sample.jsonl')
    const rows = [1, 2, 3].map((n) =>
      JSON.stringify({
        code: `500026702420${n}`,
        product_name: `Whisky ${n}`,
        brands: `Brand ${n}`,
        categories_tags: ['en:whiskies'],
        alcohol_100g: 40,
      })
    )
    await writeFile(filePath, `${rows.join('\n')}\n`, 'utf8')

    const service = new CatalogOffDumpService()
    const summary = await service.importFile({
      filePath,
      dryRun: true,
      limit: 2,
      dedupe: true,
      lookup: {
        persistDraft: async () => ({}) as never,
      } as unknown as CatalogLookupService,
    })

    assert.equal(summary.drafted, 2)
    assert.isTrue(summary.stoppedForLimit)
  })
})
