import { test } from '@japa/runner'
import {
  MEMORY_REVIEW_MIN_CHARS,
  memorySheetCompleteness,
  memorySheetMissingHintFr,
} from '@atasoif/shared'

test.group('memory sheet completeness', () => {
  test('counts four fields and rejects short reviews', ({ assert }) => {
    const empty = memorySheetCompleteness({})
    assert.equal(empty.filled, 0)
    assert.isFalse(empty.complete)
    assert.deepEqual(empty.segments, [false, false, false, false])
    assert.equal(empty.missing.length, 4)

    const partial = memorySheetCompleteness({
      pricePaid: 42,
      boughtAt: 'Nicolas',
      note: 7.5,
      review: 'ok',
    })
    assert.equal(partial.filled, 3)
    assert.isFalse(partial.complete)
    assert.deepEqual(partial.missing, ['review'])

    const complete = memorySheetCompleteness({
      pricePaid: '39,90',
      boughtAt: '  Cave  ',
      note: '8',
      review: 'a'.repeat(MEMORY_REVIEW_MIN_CHARS),
    })
    assert.isTrue(complete.complete)
    assert.equal(complete.filled, 4)
    assert.deepEqual(complete.segments, [true, true, true, true])
  })

  test('builds a soft French hint without blocking', ({ assert }) => {
    assert.isNull(
      memorySheetMissingHintFr({
        pricePaid: 10,
        boughtAt: 'Lidl',
        note: 6,
        review: 'Un whisky tourbé assez long en bouche',
      }),
    )
    assert.match(
      memorySheetMissingHintFr({ boughtAt: 'Nicolas' }) ?? '',
      /fiche complète/,
    )
  })
})
