import { planLabel, subscriptionStatusLabel } from './subscription-copy';

describe('subscription-copy', () => {
  it('labels known plans in French', () => {
    expect(planLabel('monthly')).toBe('Mensuel');
    expect(planLabel('yearly')).toBe('Annuel');
    expect(planLabel(null)).toBeNull();
  });

  it('builds freemium and premium status lines', () => {
    expect(
      subscriptionStatusLabel({ count: 3, limit: 10, remaining: 7, entitlement: false, plan: null }),
    ).toBe('Gratuit · 3/10');
    expect(
      subscriptionStatusLabel({
        count: 12,
        limit: 10,
        remaining: null,
        entitlement: true,
        plan: 'yearly',
      }),
    ).toBe('Premium · Annuel');
    expect(
      subscriptionStatusLabel({
        count: 2,
        limit: 10,
        remaining: null,
        entitlement: true,
        plan: null,
      }),
    ).toBe('Premium actif');
  });
});
