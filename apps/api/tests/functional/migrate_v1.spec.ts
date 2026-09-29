import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import User from '#models/user'
import UserBottle from '#models/user_bottle'
import Subscription from '#models/subscription'
import BottleSource from '#models/bottle_source'
import V1MigrationService from '#services/v1_migration/v1_migration_service'
import {
  LEGACY_SUBSCRIPTION_PROVIDER,
  V1_BOTTLE_SOURCE,
} from '#services/v1_migration/v1_field_mapper'

test.group('migrate:v1 service', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function seedCategories() {
    for (const slug of ['whisky', 'beer', 'rhum'] as const) {
      await Category.updateOrCreate({ slug }, { name: slug })
    }
  }

  async function fakeArgonHash(plain: string) {
    return hash.use('argon').make(plain)
  }

  test('imports users + bottles, grants legacy premium, is idempotent', async ({ assert }) => {
    await seedCategories()
    const passwordHash = await fakeArgonHash('motdepasse1')

    const source = {
      users: [
        {
          id: 8,
          email: 'owner@example.test',
          pseudo: 'Owner',
          firstname: 'Ada',
          lastname: 'Lovelace',
          is_verified: true,
          password: passwordHash,
        },
        {
          id: 15,
          email: 'dup@example.test',
          pseudo: 'DupKeep',
          firstname: 'Keep',
          lastname: 'Me',
          is_verified: false,
          password: passwordHash,
        },
        {
          id: 16,
          email: 'dup@example.test',
          pseudo: 'DupSkip',
          firstname: 'Skip',
          lastname: 'Me',
          is_verified: false,
          password: passwordHash,
        },
      ],
      bottles: [
        {
          id: 1,
          name: 'Fixture Malt',
          description: 'desc',
          review: 'review text',
          note: 7.5,
          price: 42,
          photo: 'https://example.test/malt.jpg',
          origin_country: 'Écosse',
          supplier_name: 'Cave Test',
          supplier_address: null,
          type_name: 'Single Malt',
          label_name: 'Bon',
          label_color: '#0F0',
          peat_level_name: 'Non tourbé',
          user_id: 8,
          categorySlug: 'whisky' as const,
        },
        {
          id: 2,
          name: 'test',
          description: 'keep me',
          review: null,
          note: 1.6,
          price: 1,
          photo: 'https://example.test/test.jpg',
          origin_country: 'FR',
          supplier_name: 'Shop',
          supplier_address: '1 rue',
          type_name: 'Lager',
          label_name: 'Moyen',
          label_color: '#FF0',
          user_id: 8,
          categorySlug: 'beer' as const,
        },
      ],
    }

    const service = new V1MigrationService()
    const first = await service.run({ source })
    assert.equal(first.users.created, 2)
    assert.equal(first.users.skippedDuplicate, 1)
    assert.equal(first.bottles.userBottlesCreated, 2)
    assert.equal(first.subscriptions.upserted, 2)

    const owner = await User.findByOrFail('email', 'owner@example.test')
    assert.isTrue(owner.password.startsWith('$argon2'))
    assert.equal(owner.fullName, 'Ada Lovelace')
    assert.isTrue(owner.emailVerified)
    assert.equal(owner.bottlesCreatedCount, 2)

    const sub = await Subscription.findByOrFail('user_id', owner.id)
    assert.equal(sub.provider, LEGACY_SUBSCRIPTION_PROVIDER)
    assert.equal(sub.status, 'ACTIVE')
    assert.isNull(sub.currentPeriodEnd)

    const rows = await UserBottle.query().where('user_id', owner.id).orderBy('id')
    assert.lengthOf(rows, 2)
    assert.equal(rows[0].boughtAt, 'Cave Test')
    assert.equal(Number(rows[0].note), 7.5)
    assert.equal(rows[0].photoUrlOverride, 'https://example.test/malt.jpg')
    assert.equal(rows[0].fillLevel, 100)
    assert.equal(rows[1].boughtAt, 'Shop — 1 rue')
    assert.equal(rows[1].nameOverride, null)

    const sources = await BottleSource.query().where('source', V1_BOTTLE_SOURCE)
    assert.lengthOf(sources, 2)

    const authenticated = await User.verifyCredentials('owner@example.test', 'motdepasse1')
    assert.equal(authenticated.id, owner.id)

    const second = await service.run({ source })
    assert.equal(second.users.created, 0)
    assert.equal(second.users.skippedExisting, 2)
    assert.equal(second.bottles.userBottlesCreated, 0)
    assert.equal(second.bottles.userBottlesSkipped, 2)

    const count = await UserBottle.query().where('user_id', owner.id).count('* as total')
    assert.equal(Number(count[0].$extras.total), 2)

    const catalog = await BottleSource.query()
      .where('source', V1_BOTTLE_SOURCE)
      .preload('bottle')
    for (const row of catalog) {
      assert.isNull(row.bottle.photoUrl)
    }
  })

  test('does not overwrite a non-legacy subscription on re-run', async ({ assert }) => {
    await seedCategories()
    const passwordHash = await fakeArgonHash('motdepasse1')
    const user = await User.create({
      email: 'iap@example.test',
      password: 'motdepasse1',
      fullName: 'IAP User',
      emailVerified: true,
      bottlesCreatedCount: 0,
    })
    await Subscription.create({
      userId: user.id,
      plan: 'monthly',
      status: 'ACTIVE',
      provider: 'revenuecat',
      providerCustomerId: 'rc_1',
      providerSubscriptionId: 'sub_1',
      currentPeriodEnd: null,
    })

    await new V1MigrationService().run({
      source: {
        users: [
          {
            id: 99,
            email: 'iap@example.test',
            pseudo: 'Iap',
            firstname: 'IAP',
            lastname: 'User',
            is_verified: true,
            password: passwordHash,
          },
        ],
        bottles: [],
      },
    })

    const sub = await Subscription.findByOrFail('user_id', user.id)
    assert.equal(sub.provider, 'revenuecat')
    assert.equal(sub.plan, 'monthly')
    assert.equal(sub.providerCustomerId, 'rc_1')
  })

  test('dry-run does not write rows', async ({ assert }) => {
    await seedCategories()
    const passwordHash = await fakeArgonHash('motdepasse1')
    const service = new V1MigrationService()
    const summary = await service.run({
      dryRun: true,
      source: {
        users: [
          {
            id: 1,
            email: 'dry@example.test',
            pseudo: 'Dry',
            firstname: 'Dry',
            lastname: 'Run',
            is_verified: true,
            password: passwordHash,
          },
        ],
        bottles: [],
      },
    })
    assert.equal(summary.users.created, 1)
    assert.isNull(await User.findBy('email', 'dry@example.test'))
  })
})
