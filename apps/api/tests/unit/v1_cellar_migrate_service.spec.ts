import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Subscription from '#models/subscription'
import User from '#models/user'
import UserBottle from '#models/user_bottle'
import BottleSource from '#models/bottle_source'
import V1CellarMigrateService, {
  LEGACY_V1_PROVIDER,
  dedupeV1Users,
  mergeReview,
  type V1MigratePayload,
} from '#services/migrate/v1_cellar_migrate_service'

test.group('V1 cellar migrate helpers', () => {
  test('dedupeV1Users keeps lowest id per email', ({ assert }) => {
    const { kept, skippedDuplicateIds } = dedupeV1Users([
      {
        id: 16,
        email: 'lplin@orange.fr',
        pseudo: 'Louis',
        firstname: 'L',
        lastname: 'P',
        is_admin: false,
        is_verified: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 15,
        email: 'LPLIN@orange.fr',
        pseudo: 'Louis',
        firstname: 'L',
        lastname: 'P',
        is_admin: false,
        is_verified: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ])
    assert.deepEqual(skippedDuplicateIds, [16])
    assert.lengthOf(kept, 1)
    assert.equal(kept[0].id, 15)
  })

  test('mergeReview keeps both when distinct', ({ assert }) => {
    assert.deepEqual(mergeReview('desc', 'rev'), {
      review: 'rev',
      descriptionAttr: 'desc',
    })
    assert.deepEqual(mergeReview('same', 'same'), {
      review: 'same',
      descriptionAttr: null,
    })
    assert.deepEqual(mergeReview('only', null), {
      review: 'only',
      descriptionAttr: null,
    })
  })
})

test.group('V1 cellar migrate service', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function seedCategories() {
    await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
    await Category.updateOrCreate({ slug: 'beer' }, { name: 'Bière' })
    await Category.updateOrCreate({ slug: 'rhum' }, { name: 'Rhum' })
  }

  test('imports user + bottle + legacy premium and is idempotent', async ({ assert }) => {
    await seedCategories()

    const argonHash = await hash.use('argon').make('motdepasse-v1')
    assert.isTrue(argonHash.startsWith('$argon2'))
    const payload: V1MigratePayload = {
      users: [
        {
          id: 8,
          email: 'tongo33@gmail.com',
          pseudo: 'Tongo',
          firstname: 'Anthony',
          lastname: 'Marcelin',
          is_admin: true,
          is_verified: true,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
          password: argonHash,
        },
      ],
      whisky: [
        {
          id: 5,
          name: 'Ben bracken',
          description: 'Notes malt',
          review: 'Bon rapport',
          note: 6.0,
          price: 18,
          photo: 'https://ik.imagekit.io/atasoif/example.jpg',
          origin_country: 'Écosse',
          supplier_name: 'Carrefour',
          supplier_address: null,
          type_name: 'Blended Whisky',
          peat_level_name: 'Non tourbé',
          label_name: 'Bon',
          label_color: '#0F0',
          user_id: 8,
          created_at: '2025-01-02T00:00:00.000Z',
          updated_at: '2025-01-02T00:00:00.000Z',
        },
      ],
      beer: [],
      rhum: [],
    }

    const service = new V1CellarMigrateService()
    const first = await service.run({ payload })
    assert.equal(first.usersCreated, 1)
    assert.equal(first.bottlesCreated, 1)
    assert.equal(first.userBottlesCreated, 1)
    assert.equal(first.subscriptionsUpserted, 1)

    const user = await User.findByOrFail('email', 'tongo33@gmail.com')
    assert.equal(user.pseudo, 'Tongo')
    assert.isTrue(user.emailVerified)
    assert.equal(user.bottlesCreatedCount, 1)
    assert.isTrue(user.password.startsWith('$argon2'))
    assert.isTrue(await user.verifyPassword('motdepasse-v1'))

    const sub = await Subscription.findByOrFail('userId', user.id)
    assert.equal(sub.provider, LEGACY_V1_PROVIDER)
    assert.equal(sub.status, 'ACTIVE')
    assert.isNull(sub.currentPeriodEnd)

    const ub = await UserBottle.query().where('user_id', user.id).firstOrFail()
    assert.equal(ub.boughtAt, 'Carrefour')
    assert.equal(Number(ub.pricePaid), 18)
    assert.equal(Number(ub.note), 6)
    assert.equal(ub.review, 'Bon rapport')
    assert.equal(ub.fillLevel, 100)
    assert.equal(ub.photoUrlOverride, 'https://ik.imagekit.io/atasoif/example.jpg')

    const source = await BottleSource.findByOrFail({
      source: 'user',
      externalId: 'v1:whisky:5',
    })
    assert.equal(source.bottleId, ub.bottleId)

    const second = await service.run({ payload })
    assert.equal(second.usersExisting, 1)
    assert.equal(second.usersCreated, 0)
    assert.equal(second.bottlesReused, 1)
    assert.equal(second.userBottlesSkipped, 1)
    const countRow = await UserBottle.query().where('user_id', user.id).count('* as total')
    assert.equal(Number(countRow[0].$extras.total), 1)
  })
})
