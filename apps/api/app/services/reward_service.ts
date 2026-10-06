import { FREE_BONUS_CAP, FREE_BOTTLE_LIMIT, memorySheetCompleteness } from '@atasoif/shared'
import Friendship from '#models/friendship'
import User from '#models/user'
import UserBottle from '#models/user_bottle'
import UserReward from '#models/user_reward'
import { readPostgresUniqueViolation } from '#services/postgres_error'

export type GrantedReward = {
  key: string
  slots: number
}

const MEMORY_5_KEY = 'memory_5'
const MEMORY_10_KEY = 'memory_10'

/**
 * Idempotent freemium bonus slots (conversion §2).
 * limit = FREE_BOTTLE_LIMIT + min(sum(slots), FREE_BONUS_CAP)
 */
export default class RewardService {
  async bonusSlots(userId: number): Promise<number> {
    const rows = await UserReward.query().where('user_id', userId).select('slots')
    const sum = rows.reduce((acc, row) => acc + Number(row.slots ?? 0), 0)
    return Math.min(sum, FREE_BONUS_CAP)
  }

  async effectiveLimit(userId: number): Promise<number> {
    return FREE_BOTTLE_LIMIT + (await this.bonusSlots(userId))
  }

  /**
   * Insert a reward once per (user, key). Returns the grant when newly created.
   */
  async grant(userId: number, rewardKey: string, slots: number): Promise<GrantedReward | null> {
    if (slots <= 0) {
      return null
    }
    try {
      await UserReward.create({
        userId,
        rewardKey,
        slots,
      })
      return { key: rewardKey, slots }
    } catch (error) {
      const constraint = readPostgresUniqueViolation(error)
      if (constraint && constraint.includes('user_id_reward_key')) {
        return null
      }
      // SQLite / test drivers may surface unique differently — treat duplicates as no-op.
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
      ) {
        return null
      }
      throw error
    }
  }

  /** After UserBottle create/update — memory_5 (+2) and memory_10 (+1). */
  async evaluateMemoryRewards(userId: number): Promise<GrantedReward[]> {
    const complete = await this.countCompleteMemorySheets(userId)
    const granted: GrantedReward[] = []

    if (complete >= 5) {
      const row = await this.grant(userId, MEMORY_5_KEY, 2)
      if (row) {
        granted.push(row)
      }
    }
    if (complete >= 10) {
      const row = await this.grant(userId, MEMORY_10_KEY, 1)
      if (row) {
        granted.push(row)
      }
    }
    return granted
  }

  /**
   * Invite reward for the referrer when `friendId` has verified email + ≥1 bottle.
   * Referrer = friendship requester (classic invite) or invite-code owner.
   */
  async evaluateInviteRewardsForFriend(friendId: number): Promise<GrantedReward[]> {
    const friend = await User.find(friendId)
    if (!friend?.emailVerified) {
      return []
    }

    const bottleCount = await UserBottle.query().where('user_id', friendId).count('* as total')
    if (Number(bottleCount[0].$extras.total) < 1) {
      return []
    }

    const rows = await Friendship.query()
      .where('status', 'ACCEPTED')
      .where((q) => {
        q.where('user_a_id', friendId).orWhere('user_b_id', friendId)
      })

    const granted: GrantedReward[] = []
    const rewardKey = `invite:${friendId}`

    for (const row of rows) {
      const requesterId = row.requesterId
      if (!requesterId || requesterId === friendId) {
        continue
      }
      const otherId = row.userAId === friendId ? row.userBId : row.userAId
      if (otherId !== requesterId) {
        continue
      }
      const result = await this.grant(requesterId, rewardKey, 2)
      if (result) {
        granted.push(result)
      }
    }

    return granted
  }

  private async countCompleteMemorySheets(userId: number): Promise<number> {
    const rows = await UserBottle.query()
      .where('user_id', userId)
      .select('price_paid', 'bought_at', 'note', 'review')

    let complete = 0
    for (const row of rows) {
      if (
        memorySheetCompleteness({
          pricePaid: row.pricePaid,
          boughtAt: row.boughtAt,
          note: row.note,
          review: row.review,
        }).complete
      ) {
        complete += 1
      }
    }
    return complete
  }
}
