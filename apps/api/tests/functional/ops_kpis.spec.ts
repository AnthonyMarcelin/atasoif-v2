import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { FREE_BOTTLE_LIMIT } from '@atasoif/shared'
import env from '#start/env'
import User from '#models/user'
import Category from '#models/category'
import Bottle from '#models/bottle'
import UserBottle from '#models/user_bottle'
import { OPS_TOKEN_HEADER } from '#middleware/ops_token_middleware'
import { OPS_STUB_REASONS } from '#services/ops/ops_kpi_service'
import VerifyEmailNotification from '#mails/verify_email_notification'

const OPS_TOKEN = 'ops-kpi-test-token'

test.group('Ops KPI API (E2-T09)', (group) => {
  group.each.setup(() => {
    env.set('OPS_ADMIN_TOKEN', '')
    return testUtils.db().withGlobalTransaction()
  })

  function authed(client: any) {
    return client.get('/api/v1/ops/kpis').header(OPS_TOKEN_HEADER, OPS_TOKEN)
  }

  test('rejects a missing token', async ({ client }) => {
    const response = await client.get('/api/v1/ops/kpis').header('Accept', 'application/json')
    response.assertStatus(401)
    response.assertBodyContains({ code: 'E_OPS_UNAUTHORIZED', message: 'Accès ops refusé' })
  })

  test('rejects a wrong token', async ({ client }) => {
    env.set('OPS_ADMIN_TOKEN', OPS_TOKEN)
    const response = await client
      .get('/api/v1/ops/kpis')
      .header(OPS_TOKEN_HEADER, 'not-the-ops-token')
      .header('Accept', 'application/json')
    response.assertStatus(401)
    response.assertBodyContains({ code: 'E_OPS_UNAUTHORIZED' })
  })

  test('ignores a user bearer token', async ({ client }) => {
    env.set('OPS_ADMIN_TOKEN', OPS_TOKEN)
    using fake = mail.fake()
    const signup = await client.post('/api/v1/auth/signup').json({
      email: 'ops-bearer@example.com',
      password: 'motdepasse1',
      passwordConfirmation: 'motdepasse1',
      fullName: 'Ops Bearer',
      pseudo: 'ops_bearer',
    })
    fake.mails.assertSent(VerifyEmailNotification)
    const token = (signup.body() as { data: { token: string } }).data.token

    const asBearer = await client
      .get('/api/v1/ops/kpis')
      .bearerToken(token)
      .header('Accept', 'application/json')
    asBearer.assertStatus(401)

    const asOpsHeader = await client
      .get('/api/v1/ops/kpis')
      .header(OPS_TOKEN_HEADER, token)
      .header('Accept', 'application/json')
    asOpsHeader.assertStatus(401)
  })

  test('stays closed when the admin token is blank', async ({ client }) => {
    env.set('OPS_ADMIN_TOKEN', '   ')
    const response = await client
      .get('/api/v1/ops/kpis')
      .header(OPS_TOKEN_HEADER, OPS_TOKEN)
      .header('Accept', 'application/json')
    response.assertStatus(401)
  })

  test('returns live cellar aggregates and explicit stubs', async ({ client, assert }) => {
    env.set('OPS_ADMIN_TOKEN', OPS_TOKEN)
    const category = await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
    const lagavulin = await Bottle.create({
      name: 'Lagavulin 16',
      brand: 'Lagavulin',
      categoryId: category.id,
      attrs: {},
    })
    const orval = await Bottle.create({
      name: 'Orval',
      brand: 'Orval',
      categoryId: category.id,
      attrs: {},
    })
    const nikka = await Bottle.create({
      name: 'Nikka FTB',
      brand: 'Nikka',
      categoryId: category.id,
      attrs: {},
    })

    const alice = await User.create({
      email: 'alice-ops@example.com',
      password: 'motdepasse1',
      fullName: 'Alice Ops',
      emailVerified: true,
    })
    const empty = await User.create({
      email: 'empty-ops@example.com',
      password: 'motdepasse1',
      fullName: 'Empty Ops',
      emailVerified: true,
    })
    const bob = await User.create({
      email: 'bob-ops@example.com',
      password: 'motdepasse1',
      fullName: 'Bob Ops',
      emailVerified: true,
    })

    const today = DateTime.utc()
    const yesterday = today.minus({ days: 1 })

    await UserBottle.createMany([
      {
        userId: alice.id,
        bottleId: lagavulin.id,
        boughtAt: 'Nicolas',
        pricePaid: 10,
        note: 4,
        review: 'Souvenir',
        fillLevel: 0,
        fillLevelUpdatesCount: 2,
        isPublic: false,
        createdAt: today,
      },
      {
        userId: alice.id,
        bottleId: orval.id,
        boughtAt: 'Nicolas',
        pricePaid: 30,
        note: 2,
        review: null,
        fillLevel: 100,
        fillLevelUpdatesCount: 0,
        isPublic: false,
        createdAt: today,
      },
      {
        userId: alice.id,
        bottleId: nikka.id,
        boughtAt: '   ',
        pricePaid: null,
        note: null,
        review: '   ',
        fillLevel: 100,
        fillLevelUpdatesCount: 1,
        isPublic: false,
        createdAt: today,
      },
      {
        userId: bob.id,
        bottleId: lagavulin.id,
        boughtAt: 'Cave du coin',
        pricePaid: 50,
        note: 5,
        review: 'Encore',
        fillLevel: 40,
        fillLevelUpdatesCount: 0,
        isPublic: false,
        createdAt: yesterday,
      },
    ])

    const response = await authed(client).header('Accept', 'application/json')
    response.assertStatus(200)
    const body = response.body() as {
      generatedAt: string
      overview: {
        bottlesAddedToday: { status: string; value: number }
        bottlesTotal: { value: number }
        bottlesPerUser: { mean: number; median: number }
        sessionsPerWeek: { status: string; value: null; reasonCode: string }
        revenue: { status: string; value: null; reasonCode: string }
      }
      conversion: {
        window: { id: string }
        measuredAt30Days: { status: string; reasonCode: string }
        funnel: Array<{
          id: string
          status: string
          count: number | null
          percent: number | null
          lostFromPreviousPercent: number | null
          threshold?: number
          reasonCode?: string
        }>
        delayBeforeSubscription: { status: string }
        subscriptionTriggers: { status: string }
        planMix: { status: string }
      }
      habitudes: {
        bottlesInCellar: { value: number }
        perUser: { mean: number; median: number }
        averagePrice: { mean: number | null; median: number | null; sampleSize: number }
        averageNote: { value: number | null; sampleSize: number }
        withWrittenReview: { count: number; percent: number }
        finished: { count: number; percent: number }
        topBottles: {
          items: Array<{
            name: string
            cellars: number
            averagePrice: number | null
            averageNote: number | null
          }>
        }
        priceDistribution: { buckets: Array<{ label: string; count: number }> }
        priceByPlan: { status: string; reasonCode: string }
        purchasePlaces: {
          declaredCount: number
          items: Array<{ place: string; count: number; percent: number }>
        }
        bottleLifetimeDays: { status: string; reasonCode: string }
        levelUpdates: { meanPerBottle: number | null; total: number }
        repurchase: { status: string; reasonCode: string }
      }
    }

    assert.match(body.generatedAt, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(body.overview.bottlesAddedToday.status, 'live')
    assert.equal(body.overview.bottlesAddedToday.value, 3)
    assert.equal(body.overview.bottlesTotal.value, 4)
    assert.equal(body.overview.bottlesPerUser.mean, 1.33)
    assert.equal(body.overview.bottlesPerUser.median, 1)
    assert.equal(body.overview.sessionsPerWeek.status, 'stub')
    assert.isNull(body.overview.sessionsPerWeek.value)
    assert.equal(body.overview.sessionsPerWeek.reasonCode, OPS_STUB_REASONS.noSessionAnalytics)
    assert.equal(body.overview.revenue.reasonCode, OPS_STUB_REASONS.billingNotImplemented)

    assert.equal(body.conversion.window.id, 'all_time')
    assert.equal(body.conversion.measuredAt30Days.status, 'stub')
    assert.equal(
      body.conversion.measuredAt30Days.reasonCode,
      OPS_STUB_REASONS.cohortWindowNotImplemented
    )
    assert.deepEqual(
      body.conversion.funnel.map((stage) => ({
        id: stage.id,
        status: stage.status,
        count: stage.count,
        percent: stage.percent,
        lostFromPreviousPercent: stage.lostFromPreviousPercent,
        threshold: stage.threshold,
        reasonCode: stage.reasonCode,
      })),
      [
        {
          id: 'account_created',
          status: 'live',
          count: 3,
          percent: 100,
          lostFromPreviousPercent: null,
          threshold: undefined,
          reasonCode: undefined,
        },
        {
          id: 'first_bottle',
          status: 'live',
          count: 2,
          percent: 66.7,
          lostFromPreviousPercent: 33.3,
          threshold: 1,
          reasonCode: undefined,
        },
        {
          id: 'three_bottles',
          status: 'live',
          count: 1,
          percent: 33.3,
          lostFromPreviousPercent: 50,
          threshold: 3,
          reasonCode: undefined,
        },
        {
          id: 'cellar_full',
          status: 'live',
          count: 0,
          percent: 0,
          lostFromPreviousPercent: 100,
          threshold: FREE_BOTTLE_LIMIT,
          reasonCode: undefined,
        },
        {
          id: 'paywall_viewed',
          status: 'stub',
          count: null,
          percent: null,
          lostFromPreviousPercent: null,
          threshold: undefined,
          reasonCode: OPS_STUB_REASONS.paywallEventsNotTracked,
        },
        {
          id: 'subscription_paid',
          status: 'stub',
          count: null,
          percent: null,
          lostFromPreviousPercent: null,
          threshold: undefined,
          reasonCode: OPS_STUB_REASONS.billingNotImplemented,
        },
      ]
    )
    assert.equal(body.conversion.delayBeforeSubscription.status, 'stub')
    assert.equal(body.conversion.subscriptionTriggers.status, 'stub')
    assert.equal(body.conversion.planMix.status, 'stub')

    assert.equal(body.habitudes.bottlesInCellar.value, 4)
    assert.equal(body.habitudes.perUser.mean, 1.33)
    assert.equal(body.habitudes.perUser.median, 1)
    assert.equal(body.habitudes.averagePrice.mean, 30)
    assert.equal(body.habitudes.averagePrice.median, 30)
    assert.equal(body.habitudes.averagePrice.sampleSize, 3)
    assert.equal(body.habitudes.averageNote.value, 3.7)
    assert.equal(body.habitudes.averageNote.sampleSize, 3)
    assert.equal(body.habitudes.withWrittenReview.count, 2)
    assert.equal(body.habitudes.withWrittenReview.percent, 50)
    assert.equal(body.habitudes.finished.count, 1)
    assert.equal(body.habitudes.finished.percent, 25)
    assert.deepEqual(
      body.habitudes.topBottles.items.map((item) => item.name),
      ['Lagavulin 16', 'Nikka FTB', 'Orval']
    )
    assert.equal(body.habitudes.topBottles.items[0].cellars, 2)
    assert.equal(body.habitudes.topBottles.items[0].averagePrice, 30)
    assert.equal(body.habitudes.topBottles.items[0].averageNote, 4.5)
    assert.deepEqual(
      body.habitudes.purchasePlaces.items.map((item) => [item.place, item.count, item.percent]),
      [
        ['Nicolas', 2, 66.7],
        ['Cave du coin', 1, 33.3],
      ]
    )
    assert.equal(body.habitudes.purchasePlaces.declaredCount, 3)
    assert.equal(body.habitudes.levelUpdates.total, 3)
    assert.equal(body.habitudes.levelUpdates.meanPerBottle, 0.75)
    assert.equal(
      body.habitudes.bottleLifetimeDays.reasonCode,
      OPS_STUB_REASONS.noOpenOrFinishedTimestamp
    )
    assert.equal(body.habitudes.repurchase.reasonCode, OPS_STUB_REASONS.sameBottleRowUnique)
    assert.equal(body.habitudes.priceByPlan.reasonCode, OPS_STUB_REASONS.billingNotImplemented)

    const serialized = JSON.stringify(body)
    assert.notInclude(serialized, OPS_TOKEN)
    assert.notInclude(serialized, 'alice-ops@example.com')
    assert.notInclude(serialized, 'motdepasse1')
    assert.notInclude(serialized, empty.email)
  })

  test('buckets prices on the mockup cuts, including under 10', async ({ client, assert }) => {
    env.set('OPS_ADMIN_TOKEN', OPS_TOKEN)
    const category = await Category.updateOrCreate({ slug: 'rhum' }, { name: 'Rhum' })
    const user = await User.create({
      email: 'prices-ops@example.com',
      password: 'motdepasse1',
      fullName: 'Prices Ops',
      emailVerified: true,
    })
    const prices = [9.99, 10, 24.99, 25, 79.99, 80, 150]
    for (const [index, pricePaid] of prices.entries()) {
      const bottle = await Bottle.create({
        name: `Price ${index}`,
        categoryId: category.id,
        attrs: {},
      })
      await UserBottle.create({
        userId: user.id,
        bottleId: bottle.id,
        boughtAt: 'Rayon',
        pricePaid,
        fillLevel: 100,
        fillLevelUpdatesCount: 0,
        isPublic: false,
      })
    }

    const response = await authed(client)
    response.assertStatus(200)
    const buckets = (
      response.body() as {
        habitudes: {
          priceDistribution: {
            pricedCount: number
            buckets: Array<{ label: string; count: number }>
          }
        }
      }
    ).habitudes.priceDistribution
    assert.equal(buckets.pricedCount, 7)
    assert.deepEqual(
      buckets.buckets.map((bucket) => [bucket.label, bucket.count]),
      [
        ['0-10', 1],
        ['10-25', 2],
        ['25-50', 1],
        ['50-80', 1],
        ['80-150', 1],
        ['150+', 1],
      ]
    )
  })

  test('returns zeros and stubs when the cellar is empty', async ({ client, assert }) => {
    env.set('OPS_ADMIN_TOKEN', OPS_TOKEN)
    const response = await authed(client)
    response.assertStatus(200)
    const body = response.body() as {
      overview: {
        bottlesTotal: { value: number }
        bottlesPerUser: { mean: number; median: number }
      }
      conversion: { funnel: Array<{ id: string; count: number | null }> }
      habitudes: {
        averagePrice: { mean: number | null; sampleSize: number }
        finished: { count: number; percent: number }
        purchasePlaces: { items: unknown[] }
        levelUpdates: { meanPerBottle: number | null; total: number }
        repurchase: { status: string }
      }
    }
    assert.equal(body.overview.bottlesTotal.value, 0)
    assert.equal(body.overview.bottlesPerUser.mean, 0)
    assert.equal(body.overview.bottlesPerUser.median, 0)
    assert.equal(body.conversion.funnel.find((stage) => stage.id === 'account_created')?.count, 0)
    assert.isNull(body.habitudes.averagePrice.mean)
    assert.equal(body.habitudes.averagePrice.sampleSize, 0)
    assert.equal(body.habitudes.finished.count, 0)
    assert.equal(body.habitudes.finished.percent, 0)
    assert.deepEqual(body.habitudes.purchasePlaces.items, [])
    assert.isNull(body.habitudes.levelUpdates.meanPerBottle)
    assert.equal(body.habitudes.levelUpdates.total, 0)
    assert.equal(body.habitudes.repurchase.status, 'stub')
  })
})
