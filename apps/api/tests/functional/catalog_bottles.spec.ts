import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import User from '#models/user'
import Category from '#models/category'
import Bottle from '#models/bottle'
import AuthEmailTokenService from '#services/auth_email_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'

test.group('Catalog bottles API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const credentials = {
    email: 'catalog@example.com',
    password: 'motdepasse1',
    passwordConfirmation: 'motdepasse1',
    fullName: 'Catalog Test',
    pseudo: 'catalog_user',
  }

  async function signupAndVerify(client: any) {
    using fake = mail.fake()
    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)
    const token = (signup.body() as { data: { token: string } }).data.token

    const user = await User.findByOrFail('email', credentials.email)
    const verifyToken = new AuthEmailTokenService().createEmailVerificationToken(user.id)
    await client.post('/api/v1/auth/email/verify').json({ token: verifyToken })
    return token as string
  }

  async function seedBottle() {
    const category = await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
    return Bottle.create({
      name: 'Lagavulin 16',
      brand: 'Lagavulin',
      origin: 'Islay',
      abv: 43,
      volumeMl: 700,
      barcode: '5010494011782',
      photoUrl: 'https://example.com/lag.jpg',
      categoryId: category.id,
      attrs: { peat: true },
    })
  }

  test('search requires auth', async ({ client }) => {
    const response = await client
      .get('/api/v1/catalog/bottles')
      .qs({ q: 'lag' })
      .header('Accept', 'application/json')
    response.assertStatus(401)
  })

  test('search requires verified email', async ({ client }) => {
    using fake = mail.fake()
    const signup = await client.post('/api/v1/auth/signup').json(credentials)
    fake.mails.assertSent(VerifyEmailNotification)
    const token = (signup.body() as { data: { token: string } }).data.token

    const response = await client
      .get('/api/v1/catalog/bottles')
      .qs({ q: 'lag' })
      .bearerToken(token)
      .header('Accept', 'application/json')

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_EMAIL_UNVERIFIED' })
  })

  test('search returns empty list for blank query', async ({ client, assert }) => {
    const token = await signupAndVerify(client)
    await seedBottle()

    const response = await client
      .get('/api/v1/catalog/bottles')
      .bearerToken(token)
      .header('Accept', 'application/json')

    response.assertStatus(200)
    const body = response.body() as { data: unknown[] }
    assert.isArray(body.data)
    assert.lengthOf(body.data, 0)
  })

  test('search finds local bottles by name and brand', async ({ client, assert }) => {
    const token = await signupAndVerify(client)
    await seedBottle()

    const byName = await client
      .get('/api/v1/catalog/bottles')
      .qs({ q: 'lagavulin' })
      .bearerToken(token)
      .header('Accept', 'application/json')

    byName.assertStatus(200)
    const nameBody = byName.body() as {
      data: Array<{
        name: string
        brand: string | null
        photoUrl: string | null
        abv: number | null
        volumeMl: number | null
        category: { slug: string } | null
      }>
    }
    assert.lengthOf(nameBody.data, 1)
    assert.equal(nameBody.data[0].name, 'Lagavulin 16')
    assert.equal(nameBody.data[0].brand, 'Lagavulin')
    assert.equal(nameBody.data[0].photoUrl, 'https://example.com/lag.jpg')
    assert.equal(nameBody.data[0].abv, 43)
    assert.equal(nameBody.data[0].volumeMl, 700)
    assert.equal(nameBody.data[0].category?.slug, 'whisky')

    const byBrand = await client
      .get('/api/v1/catalog/bottles')
      .qs({ q: 'Islay' })
      .bearerToken(token)
      .header('Accept', 'application/json')

    // origin is not searched — expect empty
    byBrand.assertStatus(200)
    assert.lengthOf((byBrand.body() as { data: unknown[] }).data, 0)

    const brandHit = await client
      .get('/api/v1/catalog/bottles')
      .qs({ q: 'Lagav' })
      .bearerToken(token)
      .header('Accept', 'application/json')
    brandHit.assertStatus(200)
    assert.lengthOf((brandHit.body() as { data: unknown[] }).data, 1)
  })

  test('barcode cache hit returns bottle with lookupOrigin=cache', async ({ client, assert }) => {
    const token = await signupAndVerify(client)
    await seedBottle()

    const response = await client
      .get('/api/v1/catalog/bottles/barcode/5010494011782')
      .bearerToken(token)
      .header('Accept', 'application/json')

    response.assertStatus(200)
    const body = response.body() as {
      data: { name: string; barcode: string; lookupOrigin: string }
    }
    assert.equal(body.data.name, 'Lagavulin 16')
    assert.equal(body.data.barcode, '5010494011782')
    assert.equal(body.data.lookupOrigin, 'cache')
  })

  test('barcode unknown returns French 404 after providers miss', async ({ client, assert }) => {
    const token = await signupAndVerify(client)

    // Providers are called with real env URLs; safeLookup treats network/404 as miss.
    const response = await client
      .get('/api/v1/catalog/bottles/barcode/0000000000000')
      .bearerToken(token)
      .header('Accept', 'application/json')

    response.assertStatus(404)
    const body = response.body() as { code?: string; message?: string }
    assert.equal(body.code, 'E_BOTTLE_NOT_FOUND')
    assert.match(body.message ?? '', /bouteille/i)
  })

  test('barcode validator rejects non-digit codes', async ({ client }) => {
    const token = await signupAndVerify(client)
    const invalid = await client
      .get('/api/v1/catalog/bottles/barcode/abc')
      .bearerToken(token)
      .header('Accept', 'application/json')
    invalid.assertStatus(422)
  })

  test('lists seeded categories for add-flow miss', async ({ client, assert }) => {
    const token = await signupAndVerify(client)
    await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
    await Category.updateOrCreate({ slug: 'rhum' }, { name: 'Rhum' })

    const response = await client
      .get('/api/v1/catalog/categories')
      .bearerToken(token)
      .header('Accept', 'application/json')

    response.assertStatus(200)
    const body = response.body() as { data: Array<{ id: number; slug: string; name: string }> }
    assert.isAtLeast(body.data.length, 2)
    assert.isTrue(body.data.some((row) => row.slug === 'whisky'))
  })
})
