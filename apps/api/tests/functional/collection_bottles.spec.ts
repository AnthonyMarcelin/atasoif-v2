import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { FILL_LEVEL_DEFAULT, FREE_BOTTLE_LIMIT } from '@atasoif/shared'
import User from '#models/user'
import Category from '#models/category'
import Bottle from '#models/bottle'
import UserBottle from '#models/user_bottle'
import Subscription from '#models/subscription'
import AuthEmailTokenService from '#services/auth_email_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'

test.group('Collection bottles API (E2-T03)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const credentials = {
    email: 'cellar@example.com',
    password: 'motdepasse1',
    passwordConfirmation: 'motdepasse1',
    fullName: 'Cellar Test',
    pseudo: 'cellar_user',
  }

  async function signupAndVerify(client: any, overrides: Partial<typeof credentials> = {}) {
    using fake = mail.fake()
    const body = { ...credentials, ...overrides }
    const signup = await client.post('/api/v1/auth/signup').json(body)
    fake.mails.assertSent(VerifyEmailNotification)
    const token = (signup.body() as { data: { token: string } }).data.token

    const user = await User.findByOrFail('email', body.email)
    const verifyToken = new AuthEmailTokenService().createEmailVerificationToken(user.id)
    await client.post('/api/v1/auth/email/verify').json({ token: verifyToken })
    return { token: token as string, user }
  }

  async function seedCatalogBottle(suffix = '0') {
    const category = await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
    const tag = String(suffix).replace(/\D/g, '').padStart(4, '0').slice(-4)
    return Bottle.create({
      name: `Lagavulin 16 ${suffix}`,
      brand: 'Lagavulin',
      origin: 'Islay',
      abv: 43,
      volumeMl: 700,
      barcode: `50104940${tag}`.slice(0, 13),
      photoUrl: 'https://example.com/lag.jpg',
      categoryId: category.id,
      attrs: {},
    })
  }

  async function grantPremium(userId: number) {
    await Subscription.create({
      userId,
      plan: 'monthly',
      status: 'ACTIVE',
      provider: 'stub',
      providerCustomerId: null,
      providerSubscriptionId: null,
      currentPeriodEnd: DateTime.utc().plus({ days: 30 }),
    })
  }

  test('collection requires auth', async ({ client }) => {
    const response = await client
      .get('/api/v1/collection/bottles')
      .header('Accept', 'application/json')
    response.assertStatus(401)
  })

  test('collection requires verified email', async ({ client }) => {
    using fake = mail.fake()
    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)
    const token = (signup.body() as { data: { token: string } }).data.token

    const response = await client
      .get('/api/v1/collection/bottles')
      .bearerToken(token)
      .header('Accept', 'application/json')

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_EMAIL_UNVERIFIED' })
  })

  test('free user can add from catalog with memory fields and default fill level', async ({
    client,
    assert,
  }) => {
    const { token } = await signupAndVerify(client)
    const bottle = await seedCatalogBottle()

    const response = await client.post('/api/v1/collection/bottles').bearerToken(token).json({
      bottleId: bottle.id,
      boughtAt: 'Nicolas Part-Dieu',
      pricePaid: 89.9,
      note: 4.5,
      review: 'Souvenir tourbé',
    })

    response.assertStatus(201)
    const body = response.body() as {
      data: {
        boughtAt: string
        fillLevel: number
        photoUrlOverride: string | null
        pricePaid: number
        note: number
        bottle: { photoUrl: string | null }
      }
      meta: {
        freemium: { count: number; limit: number; remaining: number | null; entitlement: boolean }
      }
    }
    assert.equal(body.data.boughtAt, 'Nicolas Part-Dieu')
    assert.equal(body.data.fillLevel, FILL_LEVEL_DEFAULT)
    assert.isNull(body.data.photoUrlOverride)
    assert.equal(body.data.pricePaid, 89.9)
    assert.equal(body.data.note, 4.5)
    assert.equal(body.data.bottle.photoUrl, 'https://example.com/lag.jpg')
    assert.equal(body.meta.freemium.count, 1)
    assert.equal(body.meta.freemium.limit, FREE_BOTTLE_LIMIT)
    assert.equal(body.meta.freemium.remaining, FREE_BOTTLE_LIMIT - 1)
    assert.isFalse(body.meta.freemium.entitlement)
  })

  test('11th create is blocked and delete does not free the slot', async ({ client, assert }) => {
    const { token, user } = await signupAndVerify(client)
    const category = await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
    const bottles = []
    for (let i = 0; i < FREE_BOTTLE_LIMIT + 1; i++) {
      bottles.push(
        await Bottle.create({
          name: `Bottle ${i}`,
          brand: 'Brand',
          categoryId: category.id,
          attrs: {},
        })
      )
    }

    const createdIds: number[] = []
    for (let i = 0; i < FREE_BOTTLE_LIMIT; i++) {
      const created = await client
        .post('/api/v1/collection/bottles')
        .bearerToken(token)
        .json({ bottleId: bottles[i].id, boughtAt: 'Cave' })
      created.assertStatus(201)
      const createdBody = created.body() as {
        data: { id: number }
        meta: { freemium: { count: number; remaining: number | null } }
      }
      assert.equal(createdBody.meta.freemium.count, i + 1)
      assert.equal(createdBody.meta.freemium.remaining, FREE_BOTTLE_LIMIT - (i + 1))
      createdIds.push(createdBody.data.id)
    }

    const blocked = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({ bottleId: bottles[FREE_BOTTLE_LIMIT].id, boughtAt: 'Cave' })
    blocked.assertStatus(403)
    const blockedBody = blocked.body() as { code: string; message: string; limit: number }
    assert.equal(blockedBody.code, 'E_BOTTLE_LIMIT')
    assert.equal(blockedBody.message, 'Cave pleine · passe premium pour continuer')
    assert.equal(blockedBody.limit, FREE_BOTTLE_LIMIT)

    const deleted = await client
      .delete(`/api/v1/collection/bottles/${createdIds[0]}`)
      .bearerToken(token)
    deleted.assertStatus(200)
    const deletedBody = deleted.body() as {
      meta: { freemium: { count: number; remaining: number | null } }
    }
    assert.equal(deletedBody.meta.freemium.count, FREE_BOTTLE_LIMIT)
    assert.equal(deletedBody.meta.freemium.remaining, 0)

    const stillBlocked = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({ bottleId: bottles[FREE_BOTTLE_LIMIT].id, boughtAt: 'Cave' })
    stillBlocked.assertStatus(403)
    assert.equal((stillBlocked.body() as { code: string }).code, 'E_BOTTLE_LIMIT')

    const fresh = await User.findOrFail(user.id)
    assert.equal(fresh.bottlesCreatedCount, FREE_BOTTLE_LIMIT)
    const rows = await UserBottle.query().where('userId', user.id)
    assert.lengthOf(rows, FREE_BOTTLE_LIMIT - 1)
  })

  test('active subscription bypasses the lifetime cap', async ({ client, assert }) => {
    const { token, user } = await signupAndVerify(client, {
      email: 'uncapped@example.com',
      pseudo: 'uncapped_user',
    })
    await grantPremium(user.id)
    user.bottlesCreatedCount = FREE_BOTTLE_LIMIT
    await user.save()
    const bottle = await seedCatalogBottle('-cap')

    const response = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({ bottleId: bottle.id, boughtAt: 'Cave' })

    response.assertStatus(201)
    const body = response.body() as {
      meta: { freemium: { count: number; remaining: number | null; entitlement: boolean } }
    }
    assert.equal(body.meta.freemium.count, FREE_BOTTLE_LIMIT + 1)
    assert.isNull(body.meta.freemium.remaining)
    assert.isTrue(body.meta.freemium.entitlement)
  })

  test('free user blocked when setting fillLevel', async ({ client, assert }) => {
    const { token } = await signupAndVerify(client)
    const bottle = await seedCatalogBottle('-fl')

    const response = await client.post('/api/v1/collection/bottles').bearerToken(token).json({
      bottleId: bottle.id,
      boughtAt: 'Nicolas',
      fillLevel: 80,
    })

    response.assertStatus(403)
    const body = response.body() as { code: string; feature: string }
    assert.equal(body.code, 'E_PREMIUM_REQUIRED')
    assert.equal(body.feature, 'fillLevel')
  })

  test('free user blocked when setting photoUrlOverride', async ({ client, assert }) => {
    const { token } = await signupAndVerify(client)
    const bottle = await seedCatalogBottle('-ph')

    const response = await client.post('/api/v1/collection/bottles').bearerToken(token).json({
      bottleId: bottle.id,
      boughtAt: 'Nicolas',
      photoUrlOverride: 'https://example.com/me.jpg',
    })

    response.assertStatus(403)
    const body = response.body() as { code: string; feature: string }
    assert.equal(body.code, 'E_PREMIUM_REQUIRED')
    assert.equal(body.feature, 'photoOverride')
  })

  test('premium stub can set fillLevel and photoUrlOverride', async ({ client, assert }) => {
    const { token, user } = await signupAndVerify(client, {
      email: 'premium@example.com',
      pseudo: 'premium_user',
    })
    await grantPremium(user.id)
    const bottle = await seedCatalogBottle('-prem')

    const create = await client.post('/api/v1/collection/bottles').bearerToken(token).json({
      bottleId: bottle.id,
      boughtAt: 'Nicolas',
      fillLevel: 60,
      photoUrlOverride: 'https://example.com/mine.jpg',
    })

    create.assertStatus(201)
    const created = create.body() as {
      data: {
        id: number
        fillLevel: number
        photoUrlOverride: string | null
        fillLevelUpdatesCount: number
      }
      meta: { freemium: { entitlement: boolean; remaining: number | null } }
    }
    assert.equal(created.data.fillLevel, 60)
    assert.equal(created.data.photoUrlOverride, 'https://example.com/mine.jpg')
    assert.equal(created.data.fillLevelUpdatesCount, 1)
    assert.isTrue(created.meta.freemium.entitlement)
    assert.isNull(created.meta.freemium.remaining)

    const update = await client
      .patch(`/api/v1/collection/bottles/${created.data.id}`)
      .bearerToken(token)
      .json({ fillLevel: 40 })

    update.assertStatus(200)
    const updated = update.body() as {
      data: { fillLevel: number; fillLevelUpdatesCount: number }
    }
    assert.equal(updated.data.fillLevel, 40)
    assert.equal(updated.data.fillLevelUpdatesCount, 2)
  })

  test('miss path creates catalog bottle with user source and cellar entry', async ({
    client,
    assert,
  }) => {
    const { token } = await signupAndVerify(client, {
      email: 'miss@example.com',
      pseudo: 'miss_user',
    })
    const category = await Category.updateOrCreate({ slug: 'rhum' }, { name: 'Rhum' })

    const response = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({
        bottle: {
          name: 'Clément VSOP',
          brand: 'Clément',
          categoryId: category.id,
          origin: 'Martinique',
        },
        boughtAt: 'Cave à rhum',
        pricePaid: 42,
      })

    response.assertStatus(201)
    const body = response.body() as {
      data: { bottleId: number; bottle: { name: string; brand: string | null } }
    }
    assert.equal(body.data.bottle.name, 'Clément VSOP')
    assert.equal(body.data.bottle.brand, 'Clément')
    assert.isNull((body.data.bottle as { photoStatus?: string | null }).photoStatus)

    const source = await Bottle.query()
      .where('id', body.data.bottleId)
      .preload('sources')
      .firstOrFail()
    assert.lengthOf(source.sources, 1)
    assert.equal(source.sources[0].source, 'user')
  })

  test('list filters by category slug and returns freemium meta', async ({ client, assert }) => {
    const { token } = await signupAndVerify(client, {
      email: 'list@example.com',
      pseudo: 'list_user',
    })
    const whisky = await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
    const rhum = await Category.updateOrCreate({ slug: 'rhum' }, { name: 'Rhum' })

    const wBottle = await Bottle.create({
      name: 'Ardbeg',
      brand: 'Ardbeg',
      categoryId: whisky.id,
      attrs: {},
    })
    const rBottle = await Bottle.create({
      name: 'Depaz',
      brand: 'Depaz',
      categoryId: rhum.id,
      attrs: {},
    })

    const whiskyAdd = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({ bottleId: wBottle.id, boughtAt: 'A' })
    whiskyAdd.assertStatus(201)
    const rhumAdd = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({ bottleId: rBottle.id, boughtAt: 'B' })
    rhumAdd.assertStatus(201)

    const response = await client
      .get('/api/v1/collection/bottles')
      .qs({ category: 'whisky' })
      .bearerToken(token)

    response.assertStatus(200)
    const body = response.body() as {
      data: Array<{ bottle: { name: string } }>
      meta: { freemium: { count: number } }
    }
    assert.lengthOf(body.data, 1)
    assert.equal(body.data[0].bottle.name, 'Ardbeg')
    assert.equal(body.meta.freemium.count, 2)
  })

  test('owner-only: foreign id returns 404', async ({ client, assert }) => {
    const a = await signupAndVerify(client, {
      email: 'owner-a@example.com',
      pseudo: 'owner_a',
    })
    const b = await signupAndVerify(client, {
      email: 'owner-b@example.com',
      pseudo: 'owner_b',
    })
    const bottle = await seedCatalogBottle('-own')
    const row = await UserBottle.create({
      userId: a.user.id,
      bottleId: bottle.id,
      boughtAt: 'Chez A',
    })

    const response = await client.get(`/api/v1/collection/bottles/${row.id}`).bearerToken(b.token)

    response.assertStatus(404)
    assert.equal((response.body() as { code: string }).code, 'E_USER_BOTTLE_NOT_FOUND')
  })

  test('update memory fields and delete entry', async ({ client, assert }) => {
    const { token } = await signupAndVerify(client, {
      email: 'edit@example.com',
      pseudo: 'edit_user',
    })
    const bottle = await seedCatalogBottle('-edit')

    const created = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({ bottleId: bottle.id, boughtAt: 'Lieu A', review: 'ok' })
    created.assertStatus(201)
    const id = (created.body() as { data: { id: number } }).data.id

    const updated = await client
      .patch(`/api/v1/collection/bottles/${id}`)
      .bearerToken(token)
      .json({ boughtAt: 'Lieu B', review: 'mieux', pricePaid: 55 })
    updated.assertStatus(200)
    const updatedBody = updated.body() as {
      data: { boughtAt: string; review: string; pricePaid: number }
    }
    assert.equal(updatedBody.data.boughtAt, 'Lieu B')
    assert.equal(updatedBody.data.review, 'mieux')
    assert.equal(updatedBody.data.pricePaid, 55)

    const deleted = await client.delete(`/api/v1/collection/bottles/${id}`).bearerToken(token)
    deleted.assertStatus(200)

    const gone = await client.get(`/api/v1/collection/bottles/${id}`).bearerToken(token)
    gone.assertStatus(404)
  })

  test('wine cellar entry stores attrsOverride and leaves the catalog bottle unchanged', async ({
    client,
    assert,
  }) => {
    const { token } = await signupAndVerify(client, {
      email: 'wine@example.com',
      pseudo: 'wine_user',
    })
    const category = await Category.updateOrCreate({ slug: 'wine' }, { name: 'Vin' })
    const bottle = await Bottle.create({
      name: 'Château Example',
      brand: 'Example',
      categoryId: category.id,
      attrs: { appellation: 'Margaux', grape: 'Merlot', vintage: '2015' },
    })

    const created = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({
        bottleId: bottle.id,
        boughtAt: 'Cave du marché',
        attrsOverride: { appellation: 'Pauillac', grape: null, vintage: null },
      })

    created.assertStatus(201)
    const createdBody = created.body() as {
      data: {
        attrsOverride: Record<string, unknown> | null
        bottle: { attrs: Record<string, unknown> }
      }
    }
    assert.deepEqual(createdBody.data.attrsOverride, { appellation: 'Pauillac' })
    assert.deepEqual(createdBody.data.bottle.attrs, {
      appellation: 'Margaux',
      grape: 'Merlot',
      vintage: '2015',
    })

    const id = (created.body() as { data: { id: number } }).data.id
    const updated = await client
      .patch(`/api/v1/collection/bottles/${id}`)
      .bearerToken(token)
      .json({
        attrsOverride: { grape: 'Cabernet franc', vintage: '' },
      })

    updated.assertStatus(200)
    const updatedBody = updated.body() as {
      data: { attrsOverride: Record<string, unknown> | null }
    }
    assert.deepEqual(updatedBody.data.attrsOverride, {
      appellation: 'Pauillac',
      grape: 'Cabernet franc',
    })

    const catalog = await Bottle.findOrFail(bottle.id)
    assert.deepEqual(catalog.attrs, {
      appellation: 'Margaux',
      grape: 'Merlot',
      vintage: '2015',
    })
  })

  test('wine miss writes wine keys on the new catalog bottle', async ({ client, assert }) => {
    const { token } = await signupAndVerify(client, {
      email: 'wine-miss@example.com',
      pseudo: 'wine_miss',
    })
    const category = await Category.updateOrCreate({ slug: 'wine' }, { name: 'Vin' })

    const response = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({
        bottle: {
          name: 'Chinon maison',
          categoryId: category.id,
          attrs: { appellation: 'Chinon', grape: 'Cabernet franc', vintage: '2018' },
        },
        boughtAt: 'Producteur',
      })

    response.assertStatus(201)
    const body = response.body() as {
      data: {
        attrsOverride: Record<string, unknown> | null
        bottle: { attrs: Record<string, unknown> }
      }
    }
    assert.deepEqual(body.data.bottle.attrs, {
      appellation: 'Chinon',
      grape: 'Cabernet franc',
      vintage: '2018',
    })
    assert.isNull(body.data.attrsOverride)
  })

  test('non-wine update rejects wine attrs and still accepts memory fields', async ({
    client,
    assert,
  }) => {
    const { token } = await signupAndVerify(client, {
      email: 'notwine@example.com',
      pseudo: 'not_wine',
    })
    const bottle = await seedCatalogBottle('-nw')
    const created = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({ bottleId: bottle.id, boughtAt: 'Nicolas' })
    created.assertStatus(201)
    const id = (created.body() as { data: { id: number } }).data.id

    const rejected = await client
      .patch(`/api/v1/collection/bottles/${id}`)
      .bearerToken(token)
      .json({ attrsOverride: { appellation: 'Margaux' } })
    rejected.assertStatus(422)
    assert.equal((rejected.body() as { code: string }).code, 'E_WINE_ATTRS_CATEGORY')

    const kept = await client
      .patch(`/api/v1/collection/bottles/${id}`)
      .bearerToken(token)
      .json({ boughtAt: 'Cave', pricePaid: 30 })
    kept.assertStatus(200)
    const keptBody = kept.body() as {
      data: { boughtAt: string; attrsOverride: Record<string, unknown> | null }
    }
    assert.equal(keptBody.data.boughtAt, 'Cave')
    assert.isNull(keptBody.data.attrsOverride)
  })

  test('create rejects missing boughtAt', async ({ client }) => {
    const { token } = await signupAndVerify(client, {
      email: 'nobought@example.com',
      pseudo: 'nobought',
    })
    const bottle = await seedCatalogBottle('-nb')

    const response = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({ bottleId: bottle.id })

    response.assertStatus(422)
  })
})
