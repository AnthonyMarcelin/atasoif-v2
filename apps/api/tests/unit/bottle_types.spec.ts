import { test } from '@japa/runner'
import { bottleTypesForCategory, readBottleType } from '@atasoif/shared'

test.group('bottle types taxo v1', () => {
  test('returns whisky types and reads attrs.type', ({ assert }) => {
    assert.include(bottleTypesForCategory('whisky') as string[], 'Single malt')
    assert.equal(readBottleType({ type: 'Blend' }), 'Blend')
    assert.equal(readBottleType({}), '')
  })
})
