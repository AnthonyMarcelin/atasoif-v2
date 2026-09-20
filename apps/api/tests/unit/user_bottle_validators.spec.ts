import { test } from '@japa/runner'
import {
  createUserBottleValidator,
  updateUserBottleValidator,
} from '#validators/user_bottle'

test.group('UserBottle validators (E2-T01)', () => {
  test('create requires boughtAt place and accepts fillLevel 0-100', async ({ assert }) => {
    const data = await createUserBottleValidator.validate({
      boughtAt: 'Cave Nicolas Lyon',
      fillLevel: 75,
      pricePaid: 42.5,
      note: 4.5,
      review: 'Très bon souvenir',
    })

    assert.equal(data.boughtAt, 'Cave Nicolas Lyon')
    assert.equal(data.fillLevel, 75)
    assert.equal(data.pricePaid, 42.5)
    assert.equal(data.note, 4.5)
  })

  test('create rejects missing boughtAt', async ({ assert }) => {
    await assert.rejects(async () => {
      await createUserBottleValidator.validate({ fillLevel: 100 })
    })
  })

  test('create rejects fillLevel outside 0-100', async ({ assert }) => {
    await assert.rejects(async () => {
      await createUserBottleValidator.validate({ boughtAt: 'Carrefour', fillLevel: 101 })
    })

    await assert.rejects(async () => {
      await createUserBottleValidator.validate({ boughtAt: 'Carrefour', fillLevel: -1 })
    })
  })

  test('update accepts optional fillLevel boundaries', async ({ assert }) => {
    const empty = await updateUserBottleValidator.validate({ fillLevel: 0 })
    assert.equal(empty.fillLevel, 0)

    const full = await updateUserBottleValidator.validate({ fillLevel: 100 })
    assert.equal(full.fillLevel, 100)
  })
})
