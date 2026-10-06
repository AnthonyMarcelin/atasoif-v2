import type { FreemiumMeta, SubscriptionPlanId } from './cellar.types';

/** FR label for an active IAP / legacy plan. */
export function planLabel(plan: SubscriptionPlanId | null | undefined): string | null {
  if (plan === 'monthly') {
    return 'Mensuel';
  }
  if (plan === 'yearly') {
    return 'Annuel';
  }
  return null;
}

/** Short status line for Mon profil / Premium shell. */
export function subscriptionStatusLabel(freemium: FreemiumMeta | null): string {
  if (!freemium) {
    return 'Chargement…';
  }
  if (freemium.entitlement) {
    const plan = planLabel(freemium.plan);
    return plan ? `Premium · ${plan}` : 'Premium actif';
  }
  const limit = freemium.limit;
  return `Gratuit · ${freemium.count}/${limit}`;
}
