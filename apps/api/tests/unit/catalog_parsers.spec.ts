import { test } from '@japa/runner'
import { parseAbv, parseVolumeMl } from '#services/catalog/parse_quantity'
import { mapCategorySlug } from '#services/catalog/map_category'
import { normalizeBarcode } from '#services/catalog/catalog_lookup_service'

test.group('Catalog parsers', () => {
  test('parseVolumeMl handles cl / ml / l', ({ assert }) => {
    assert.equal(parseVolumeMl('70 cl'), 700)
    assert.equal(parseVolumeMl('750 ml'), 750)
    assert.equal(parseVolumeMl('1 l'), 1000)
    assert.equal(parseVolumeMl('33cl'), 330)
    assert.isNull(parseVolumeMl('unknown'))
  })

  test('parseAbv accepts number and percent strings', ({ assert }) => {
    assert.equal(parseAbv(40), 40)
    assert.equal(parseAbv('40%'), 40)
    assert.equal(parseAbv('12,5'), 12.5)
    assert.isNull(parseAbv('nope'))
  })

  test('mapCategorySlug maps OFF-style tags', ({ assert }) => {
    assert.equal(mapCategorySlug(['en:whiskies']), 'whisky')
    assert.equal(mapCategorySlug(['en:beers']), 'beer')
    assert.equal(mapCategorySlug(['Hendrick’s Gin']), 'gin')
    assert.equal(mapCategorySlug(['mystery juice']), 'other')
  })

  test('normalizeBarcode keeps digit EANs only', ({ assert }) => {
    assert.equal(normalizeBarcode('5000267024202'), '5000267024202')
    assert.equal(normalizeBarcode('EAN 5000-2670-24202'), '5000267024202')
    assert.isNull(normalizeBarcode('123'))
  })
})
