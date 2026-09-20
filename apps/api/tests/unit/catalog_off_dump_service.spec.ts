import { test } from '@japa/runner'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { isAlcoholicOffProduct } from '#services/catalog/off_alcohol_filter'
import { mapOffProductToDraft } from '#services/catalog/off_product_mapper'
import CatalogOffDumpService from '#services/catalog/catalog_off_dump_service'
import type CatalogLookupService from '#services/catalog/catalog_lookup_service'
import type { CatalogProductDraft } from '#services/catalog/catalog_types'

test.group('isAlcoholicOffProduct', () => {
  test('accepts beers / wines / spirits tags', ({ assert }) => {
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:beers'] }))
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:wines', 'en:red-wines'] }))
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:whiskies'] }))
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['en:alcoholic-beverages'] }))
    assert.isTrue(isAlcoholicOffProduct({ categories_tags: ['fr:pastis'] }))
  })

  test('rejects non-alcoholic beers and soft drinks', ({ assert }) => {
    assert.isFalse(
      isAlcoholicOffProduct({
        categories_tags: ['en:beers', 'en:non-alcoholic-beers'],
        alcohol_100g: 0,
      })
    )
    assert.isFalse(isAlcoholicOffProduct({ categories_tags: ['en:sodas'] }))
    assert.isFalse(isAlcoholicOffProduct({ categories_tags: ['en:waters'] }))
  })

  test('falls back to alcohol_100g when tags are thin', ({ assert }) => {
    assert.isTrue(isAlcoholicOffProduct({ alcohol_100g: 40 }))
    assert.isFalse(isAlcoholicOffProduct({ alcohol_100g: 0 }))
    assert.isFalse(isAlcoholicOffProduct({}))
  })
})

test.group('mapOffProductToDraft', () => {
  test('maps FR name and barcode', ({ assert }) => {
    const draft = mapOffProductToDraft('5000267024202', {
      code: '5000267024202',
      product_name_fr: 'Johnnie Walker Black Label',
      brands: 'Johnnie Walker, Diageo',
      quantity: '70 cl',
      categories_tags: ['en:whiskies'],
      alcohol_100g: 40,
    })
    assert.isNotNull(draft)
    assert.equal(draft!.name, 'Johnnie Walker Black Label')
    assert.equal(draft!.brand, 'Johnnie Walker')
    assert.equal(draft!.volumeMl, 700)
    assert.equal(draft!.categorySlug, 'whisky')
    assert.equal(draft!.abv, 40)
  })
})

test.group('CatalogOffDumpService', () => {
  test('filters alcohol lines from a JSONL fixture (dry-run)', async ({ assert }) => {
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
      lookup,
    })

    assert.equal(summary.drafted, 1)
    assert.equal(summary.upserted, 0)
    assert.equal(summary.nonAlcohol, 2)
    assert.equal(summary.jsonErrors, 1)
    assert.equal(persistCalls, 0)
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
      lookup: {
        persistDraft: async () => ({}) as never,
      } as unknown as CatalogLookupService,
    })

    assert.equal(summary.drafted, 2)
    assert.isTrue(summary.stoppedForLimit)
  })
})
