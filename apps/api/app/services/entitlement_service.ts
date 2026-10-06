import { DateTime } from 'luxon'
import Subscription from '#models/subscription'

/** Known store / legacy plan ids exposed to the client. */
export type SubscriptionPlanId = 'monthly' | 'yearly'

export type EntitlementSnapshot = {
  entitled: boolean
  /** Null when free, or when the row uses an unrecognized plan id. */
  plan: SubscriptionPlanId | null
}

/**
 * Entitlement check stub until E4 IAP / RevenueCat (Sprint 4).
 * Active = subscription row with status ACTIVE and period not ended.
 */
export default class EntitlementService {
  async hasActiveEntitlement(userId: number): Promise<boolean> {
    const snapshot = await this.snapshot(userId)
    return snapshot.entitled
  }

  /**
   * Active plan for freemium meta (`monthly` / `yearly`), or null when free.
   * Unknown plan strings still count as entitled but surface as null.
   */
  async activePlan(userId: number): Promise<SubscriptionPlanId | null> {
    const snapshot = await this.snapshot(userId)
    return snapshot.plan
  }

  async snapshot(userId: number): Promise<EntitlementSnapshot> {
    const subscription = await Subscription.query().where('user_id', userId).first()
    if (!subscription) {
      return { entitled: false, plan: null }
    }
    if (subscription.status !== 'ACTIVE') {
      return { entitled: false, plan: null }
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < DateTime.utc()) {
      return { entitled: false, plan: null }
    }
    const plan =
      subscription.plan === 'monthly' || subscription.plan === 'yearly' ? subscription.plan : null
    return { entitled: true, plan }
  }
}
