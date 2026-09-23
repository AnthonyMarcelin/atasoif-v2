import { readFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import User from '#models/user'
import Category from '#models/category'
import Bottle from '#models/bottle'
import UserBottle from '#models/user_bottle'
import Subscription from '#models/subscription'
import AuthEmailTokenService from '#services/auth_email_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'
import CellarPhotoStorage from '#services/cellar_photo_storage'

const PNG_1X1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
)

test.group('Collection photos API (E2-T04)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const credentials = {
    email: 'photo@example.com',
    password: 'motdepasse1',
    passwordConfirmation: 'motdepasse1',
    fullName: 'Photo Test',
    pseudo: 'photo_user',
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

  async function seedEntry(userId: number, suffix: string) {
    const category = await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
    const bottle = await Bottle.create({
      name: `Lagavulin ${suffix}`,
      brand: 'Lagavulin',
      categoryId: category.id,
      attrs: {},
    })
    const row = await UserBottle.create({
      userId,
      bottleId: bottle.id,
      boughtAt: 'Nicolas',
    })
    return row
  }

  test('photo upload requires auth', async ({ client }) => {
    const response = await client
      .post('/api/v1/collection/bottles/1/photo')
      .header('Accept', 'application/json')
      .file('photo', PNG_1X1, { filename: 'pack.png', contentType: 'image/png' })
    response.assertStatus(401)
  })

  test('photo upload requires a verified email', async ({ client }) => {
    using fake = mail.fake()
    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)
    const token = (signup.body() as { data: { token: string } }).data.token
    const user = await User.findByOrFail('email', credentials.email)
    const row = await seedEntry(user.id, 'unverified')

    const response = await client
      .post(`/api/v1/collection/bottles/${row.id}/photo`)
      .bearerToken(token)
      .file('photo', PNG_1X1, { filename: 'pack.png', contentType: 'image/png' })

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_EMAIL_UNVERIFIED' })
  })

  test('free shelf upload is rejected and not stored', async ({ client, assert }) => {
    const { token, user } = await signupAndVerify(client)
    const row = await seedEntry(user.id, 'free')

    const response = await client
      .post(`/api/v1/collection/bottles/${row.id}/photo`)
      .bearerToken(token)
      .file('photo', PNG_1X1, { filename: 'etagere.png', contentType: 'image/png' })

    response.assertStatus(403)
    const body = response.body() as { code: string; feature: string }
    assert.equal(body.code, 'E_PREMIUM_REQUIRED')
    assert.equal(body.feature, 'photoOverride')

    const fresh = await UserBottle.findOrFail(row.id)
    assert.isNull(fresh.photoUrlOverride)
    const storage = new CellarPhotoStorage()
    assert.isNull(await storage.findOverrideFile(user.id, row.id))
  })

  test('entitled upload is stored owner-only and a bad file is refused', async ({
    client,
    assert,
  }) => {
    const { token, user } = await signupAndVerify(client, {
      email: 'photo-premium@example.com',
      pseudo: 'photo_premium',
    })
    await Subscription.create({
      userId: user.id,
      plan: 'monthly',
      status: 'ACTIVE',
      provider: 'stub',
      providerCustomerId: null,
      providerSubscriptionId: null,
      currentPeriodEnd: DateTime.utc().plus({ days: 30 }),
    })
    const row = await seedEntry(user.id, 'premium')

    const rejected = await client
      .post(`/api/v1/collection/bottles/${row.id}/photo`)
      .bearerToken(token)
      .file('photo', Buffer.from('pas une image'), {
        filename: 'note.jpg',
        contentType: 'image/jpeg',
      })
    rejected.assertStatus(422)
    assert.equal((rejected.body() as { code: string }).code, 'E_PHOTO_INVALID')

    const uploaded = await client
      .post(`/api/v1/collection/bottles/${row.id}/photo`)
      .bearerToken(token)
      .file('photo', PNG_1X1, { filename: '../../secret.png', contentType: 'image/png' })
    uploaded.assertStatus(200)
    const uploadedBody = uploaded.body() as { data: { photoUrlOverride: string | null } }
    assert.equal(uploadedBody.data.photoUrlOverride, `/api/v1/collection/bottles/${row.id}/photo`)
    assert.notMatch(uploadedBody.data.photoUrlOverride, /\.\./)

    const storage = new CellarPhotoStorage()
    const absolute = await storage.findOverrideFile(user.id, row.id)
    assert.isNotNull(absolute)
    assert.deepEqual(await readFile(absolute!), PNG_1X1)
    assert.notMatch(absolute!, /\.\./)

    const downloaded = await client.get(uploadedBody.data.photoUrlOverride!).bearerToken(token)
    downloaded.assertStatus(200)
    downloaded.assertHeader('content-type', 'image/png')
    downloaded.assertHeader('x-content-type-options', 'nosniff')

    const stranger = await signupAndVerify(client, {
      email: 'photo-other@example.com',
      pseudo: 'photo_other',
    })
    const foreign = await client
      .get(uploadedBody.data.photoUrlOverride!)
      .bearerToken(stranger.token)
    foreign.assertStatus(404)

    const deleted = await client.delete(`/api/v1/collection/bottles/${row.id}`).bearerToken(token)
    deleted.assertStatus(200)
    assert.equal(
      (deleted.body() as { meta: { freemium: { count: number } } }).meta.freemium.count,
      0
    )
    assert.isNull(await storage.findOverrideFile(user.id, row.id))
  })

  test('free user can contribute a catalog packshot on a miss', async ({ client, assert }) => {
    const { token } = await signupAndVerify(client, {
      email: 'packshot@example.com',
      pseudo: 'packshot_user',
    })
    const category = await Category.updateOrCreate({ slug: 'rhum' }, { name: 'Rhum' })

    const response = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .field('boughtAt', 'Cave du coin')
      .field(
        'bottle',
        JSON.stringify({
          name: 'Rhum maison',
          brand: 'Maison',
          categoryId: category.id,
        })
      )
      .file('catalogPhoto', PNG_1X1, { filename: '../pack.png', contentType: 'image/png' })

    response.assertStatus(201)
    const body = response.body() as {
      data: { bottle: { photoUrl: string | null; photoStatus: string | null; name: string } }
    }
    assert.equal(body.data.bottle.name, 'Rhum maison')
    assert.equal(body.data.bottle.photoStatus, 'pending')
    assert.match(body.data.bottle.photoUrl ?? '', /^\/api\/v1\/media\/catalog\/[0-9a-f-]+\.png$/)

    const media = await client.get(body.data.bottle.photoUrl!).bearerToken(token)
    media.assertStatus(200)
    media.assertHeader('content-type', 'image/png')

    const missing = await client.get('/api/v1/media/catalog/not-a-uuid.png').bearerToken(token)
    missing.assertStatus(404)

    const escape = await client
      .get('/api/v1/media/catalog/..%2F..%2Fetc%2Fpasswd')
      .bearerToken(token)
    escape.assertStatus(404)
  })

  test('free user can pass a catalog photo URL on a miss', async ({ client, assert }) => {
    const { token } = await signupAndVerify(client, {
      email: 'packurl@example.com',
      pseudo: 'packurl_user',
    })
    const category = await Category.updateOrCreate({ slug: 'gin' }, { name: 'Gin' })

    const response = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({
        bottle: {
          name: 'Gin du marché',
          categoryId: category.id,
          photoUrl: 'https://example.com/gin.jpg',
        },
        boughtAt: 'Marché',
      })

    response.assertStatus(201)
    const body = response.body() as {
      data: { bottle: { photoUrl: string | null; photoStatus: string | null } }
    }
    assert.equal(body.data.bottle.photoUrl, 'https://example.com/gin.jpg')
    assert.equal(body.data.bottle.photoStatus, 'pending')
  })
})
