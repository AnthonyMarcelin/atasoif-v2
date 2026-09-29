import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import Bottle from '#models/bottle'
import User from '#models/user'
import UserBottle from '#models/user_bottle'
import { FILL_LEVEL_DEFAULT, FILL_LEVEL_FINISHED } from '@atasoif/shared'

test.group('UserBottle fill level schema (E2-T01)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('user_bottles has fill_level and fill_level_updates_count columns', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_bottles'`
    )
    const columnNames = (result.rows as Array<{ column_name: string }>).map((row) => row.column_name)

    assert.include(columnNames, 'fill_level')
    assert.include(columnNames, 'fill_level_updates_count')
    assert.include(columnNames, 'bought_at')
    assert.notInclude(columnNames, 'purchase_place')
  })

  test('new UserBottle persists fillLevel defaults and boughtAt place', async ({ assert }) => {
    const user = await User.create({
      email: 'cellar-schema@example.com',
      password: 'motdepasse1',
      fullName: 'Schema Test',
      pseudo: 'schema_cellar',
      isPublic: false,
      emailVerified: true,
    })

    const category = await Category.create({
      slug: 'whisky-e2-t01',
      name: 'Whisky',
    })

    const bottle = await Bottle.create({
      name: 'Lagavulin 16',
      brand: 'Lagavulin',
      categoryId: category.id,
      attrs: {},
    })

    const row = await UserBottle.create({
      userId: user.id,
      bottleId: bottle.id,
      boughtAt: 'Nicolas Part-Dieu',
      pricePaid: 89.9,
      note: 4.5,
      review: 'Peaty evening',
    })

    await row.refresh()

    assert.equal(row.boughtAt, 'Nicolas Part-Dieu')
    assert.equal(row.fillLevel, FILL_LEVEL_DEFAULT)
    assert.equal(row.fillLevelUpdatesCount, 0)

    row.fillLevel = FILL_LEVEL_FINISHED
    row.fillLevelUpdatesCount = 1
    await row.save()
    await row.refresh()

    assert.equal(row.fillLevel, 0)
    assert.equal(row.fillLevelUpdatesCount, 1)
  })
})
