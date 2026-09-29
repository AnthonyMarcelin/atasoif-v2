import { DateTime } from 'luxon'
import Subscription from '#models/subscription'

/**
 * Entitlement check stub until E4 IAP / RevenueCat (Sprint 4).
 * Active = subscription row with status ACTIVE and period not ended.
 */
export default class EntitlementService {
  async hasActiveEntitlement(userId: number): Promise<boolean> {
    const subscription = await Subscription.query().where('user_id', userId).first()
    if (!subscription) {
      return false
    }
    if (subscription.status !== 'ACTIVE') {
      return false
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < DateTime.utc()) {
      return false
    }
    return true
  }
}
