import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { FREE_BOTTLE_LIMIT, FREE_BONUS_CAP } from '@atasoif/shared'
import User from '#models/user'
import Category from '#models/category'
import Bottle from '#models/bottle'
import UserBottle from '#models/user_bottle'
import UserReward from '#models/user_reward'
import Subscription from '#models/subscription'
import Friendship from '#models/friendship'
import AuthEmailTokenService from '#services/auth_email_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'

test.group('Collection rewards + lock (conversion §2–3)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function signupAndVerify(
    client: any,
    overrides: {
      email?: string
      password?: string
      passwordConfirmation?: string
      fullName?: string
      pseudo?: string
    } = {}
  ) {
    using fake = mail.fake()
    const body = {
      email: 'reward@example.com',
      password: 'motdepasse1',
      passwordConfirmation: 'motdepasse1',
      fullName: 'Reward Test',
      pseudo: 'reward_user',
      ...overrides,
    }
    const signup = await client.post('/api/v1/auth/signup').json(body)
    fake.mails.assertSent(VerifyEmailNotification)
    const token = (signup.body() as { data: { token: string } }).data.token
    const user = await User.findByOrFail('email', body.email)
    const verifyToken = new AuthEmailTokenService().createEmailVerificationToken(user.id)
    await client.post('/api/v1/auth/email/verify').json({ token: verifyToken })
    return { token: token as string, user: await User.findOrFail(user.id) }
  }

  async function seedBottle(suffix: string) {
    const category = await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
    const tag = String(suffix).replace(/\D/g, '').padStart(4, '0').slice(-4)
    return Bottle.create({
      name: `Reward bottle ${suffix}`,
      brand: 'Brand',
      categoryId: category.id,
      barcode: `50104941${tag}`.slice(0, 13),
      attrs: {},
    })
  }

  async function addCompleteSheet(client: any, token: string, bottleId: number) {
    return client.post('/api/v1/collection/bottles').bearerToken(token).json({
      bottleId,
      boughtAt: 'Cave test',
      pricePaid: 42,
      note: 8,
      review: 'Un avis assez long pour compter comme souvenir écrit.',
    })
  }

  test('freemium payload exposes bonus and effective limit', async ({ client, assert }) => {
    const { token, user } = await signupAndVerify(client)
    await UserReward.create({ userId: user.id, rewardKey: 'memory_5', slots: 2 })

    const bottle = await seedBottle('meta')
    const response = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(token)
      .json({ bottleId: bottle.id, boughtAt: 'Cave' })

    response.assertStatus(201)
    const body = response.body() as {
      meta: { freemium: { limit: number; bonus: number; remaining: number | null } }
    }
    assert.equal(body.meta.freemium.bonus, 2)
    assert.equal(body.meta.freemium.limit, FREE_BOTTLE_LIMIT + 2)
    assert.equal(body.meta.freemium.remaining, FREE_BOTTLE_LIMIT + 2 - 1)
  })

  test('memory_5 grants +2 once when five complete sheets exist', async ({ client, assert }) => {
    const { token, user } = await signupAndVerify(client, {
      email: 'memory5@example.com',
      pseudo: 'memory5_user',
    })

    let lastBody: { meta: { rewardsGranted?: Array<{ key: string; slots: number }> } } | null =
      null
    for (let i = 0; i < 5; i++) {
      const bottle = await seedBottle(`m5-${i}`)
      const created = await addCompleteSheet(client, token, bottle.id)
      created.assertStatus(201)
      lastBody = created.body() as typeof lastBody
    }

    assert.isTrue(
      (lastBody?.meta.rewardsGranted ?? []).some((row) => row.key === 'memory_5' && row.slots === 2)
    )

    const rewards = await UserReward.query().where('user_id', user.id)
    assert.lengthOf(rewards, 1)
    assert.equal(rewards[0].rewardKey, 'memory_5')
    assert.equal(Number(rewards[0].slots), 2)

    const freemium = (
      await client.get('/api/v1/collection/bottles').bearerToken(token).header('Accept', 'application/json')
    ).body() as { meta: { freemium: { bonus: number; limit: number } } }
    assert.equal(freemium.meta.freemium.bonus, 2)
    assert.equal(freemium.meta.freemium.limit, FREE_BOTTLE_LIMIT + 2)
  })

  test('invite code friend with bottle grants +2 to referrer', async ({ client, assert }) => {
    const referrer = await signupAndVerify(client, {
      email: 'referrer@example.com',
      pseudo: 'referrer_u',
    })
    referrer.user.inviteCode = 'ABC123'
    await referrer.user.save()

    const friend = await signupAndVerify(client, {
      email: 'invited@example.com',
      pseudo: 'invited_u',
    })

    const invite = await client
      .post('/api/v1/friends')
      .bearerToken(friend.token)
      .json({ target: 'ABC123' })
    invite.assertStatus(201)

    const bottle = await seedBottle('invite')
    const created = await client
      .post('/api/v1/collection/bottles')
      .bearerToken(friend.token)
      .json({ bottleId: bottle.id, boughtAt: 'Cave' })
    created.assertStatus(201)

    const rewards = await UserReward.query().where('user_id', referrer.user.id)
    assert.lengthOf(rewards, 1)
    assert.equal(rewards[0].rewardKey, `invite:${friend.user.id}`)
    assert.equal(Number(rewards[0].slots), 2)

    const friendship = await Friendship.query()
      .where('status', 'ACCEPTED')
      .where((q) => {
        q.where('user_a_id', referrer.user.id).orWhere('user_b_id', referrer.user.id)
      })
      .firstOrFail()
    assert.equal(friendship.requesterId, referrer.user.id)
  })

  test('locked bottles omit memory fields and block detail', async ({ client, assert }) => {
    const { token, user } = await signupAndVerify(client, {
      email: 'lock@example.com',
      pseudo: 'lock_user',
    })
    await grantFormerPremiumWithBottles(user.id, FREE_BOTTLE_LIMIT + 3)

    const list = await client
      .get('/api/v1/collection/bottles')
      .bearerToken(token)
      .header('Accept', 'application/json')
      .qs({ limit: 50 })
    list.assertStatus(200)
    const listBody = list.body() as {
      data: Array<{
        id: number
        locked?: boolean
        pricePaid?: number | null
        boughtAt?: string | null
        note?: number | null
        review?: string | null
        photoUrlOverride?: string | null
        fillLevel?: number
      }>
      meta: { lockedCount: number; freemium: { limit: number; entitlement: boolean } }
    }

    assert.isFalse(listBody.meta.freemium.entitlement)
    assert.equal(listBody.meta.freemium.limit, FREE_BOTTLE_LIMIT)
    assert.equal(listBody.meta.lockedCount, 3)

    const unlocked = listBody.data.filter((row) => !row.locked)
    const locked = listBody.data.filter((row) => row.locked)
    assert.lengthOf(unlocked, FREE_BOTTLE_LIMIT)
    assert.lengthOf(locked, 3)

    for (const row of locked) {
      assert.isUndefined(row.pricePaid)
      assert.isUndefined(row.boughtAt)
      assert.isUndefined(row.note)
      assert.isUndefined(row.review)
      assert.isUndefined(row.photoUrlOverride)
      assert.isUndefined(row.fillLevel)
    }

    const lockedId = locked[0].id
    const detail = await client
      .get(`/api/v1/collection/bottles/${lockedId}`)
      .bearerToken(token)
      .header('Accept', 'application/json')
    detail.assertStatus(403)
    assert.equal((detail.body() as { code: string }).code, 'E_PREMIUM_LOCKED')

    const patch = await client
      .patch(`/api/v1/collection/bottles/${lockedId}`)
      .bearerToken(token)
      .json({ boughtAt: 'Nope' })
    patch.assertStatus(403)
    assert.equal((patch.body() as { code: string }).code, 'E_PREMIUM_LOCKED')

    const del = await client.delete(`/api/v1/collection/bottles/${lockedId}`).bearerToken(token)
    del.assertStatus(403)
    assert.equal((del.body() as { code: string }).code, 'E_PREMIUM_LOCKED')
  })

  test('bonus slots raise unlock window without exceeding FREE_BONUS_CAP', async ({
    client,
    assert,
  }) => {
    const { token, user } = await signupAndVerify(client, {
      email: 'bonuscap@example.com',
      pseudo: 'bonuscap_u',
    })
    await UserReward.create({ userId: user.id, rewardKey: 'memory_5', slots: 2 })
    await UserReward.create({ userId: user.id, rewardKey: 'memory_10', slots: 1 })
    await UserReward.create({ userId: user.id, rewardKey: 'invite:99', slots: 2 })
    await UserReward.create({ userId: user.id, rewardKey: 'invite:100', slots: 2 })

    await grantFormerPremiumWithBottles(user.id, FREE_BOTTLE_LIMIT + FREE_BONUS_CAP + 2)

    const list = await client
      .get('/api/v1/collection/bottles')
      .bearerToken(token)
      .header('Accept', 'application/json')
      .qs({ limit: 50 })
    list.assertStatus(200)
    const body = list.body() as {
      data: Array<{ locked?: boolean }>
      meta: { lockedCount: number; freemium: { bonus: number; limit: number } }
    }
    assert.equal(body.meta.freemium.bonus, FREE_BONUS_CAP)
    assert.equal(body.meta.freemium.limit, FREE_BOTTLE_LIMIT + FREE_BONUS_CAP)
    assert.equal(body.meta.lockedCount, 2)
    assert.lengthOf(
      body.data.filter((row) => !row.locked),
      FREE_BOTTLE_LIMIT + FREE_BONUS_CAP
    )
  })
})

async function grantFormerPremiumWithBottles(userId: number, total: number) {
  const category = await Category.updateOrCreate({ slug: 'whisky' }, { name: 'Whisky' })
  const sub = await Subscription.create({
    userId,
    plan: 'monthly',
    status: 'ACTIVE',
    provider: 'stub',
    providerCustomerId: null,
    providerSubscriptionId: null,
    currentPeriodEnd: DateTime.utc().plus({ days: 30 }),
  })

  for (let i = 0; i < total; i++) {
    const bottle = await Bottle.create({
      name: `Lock bottle ${userId}-${i}`,
      brand: 'Brand',
      categoryId: category.id,
      attrs: {},
    })
    await UserBottle.create({
      userId,
      bottleId: bottle.id,
      boughtAt: `Lieu ${i}`,
      pricePaid: 10 + i,
      note: 7,
      review: 'Souvenir verrouillé pour le test de retour gratuit.',
      fillLevel: 100,
      fillLevelUpdatesCount: 0,
      photoUrlOverride: null,
      isPublic: false,
      createdAt: DateTime.utc().minus({ minutes: total - i }),
    })
  }

  const user = await User.findOrFail(userId)
  user.bottlesCreatedCount = total
  await user.save()

  sub.status = 'EXPIRED'
  sub.currentPeriodEnd = DateTime.utc().minus({ days: 1 })
  await sub.save()
}
