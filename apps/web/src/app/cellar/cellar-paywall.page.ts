import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FREE_BOTTLE_LIMIT, PLANS } from '@atasoif/shared';

import { BottlePhoto } from './bottle-photo';
import { CellarShell } from './cellar-shell';
import {
  displayName,
  displayPhotoUrl,
  type FreemiumMeta,
  type UserBottle,
} from './cellar.types';
import { CollectionService } from './collection.service';
import { NativeShareService } from './native-share.service';
import { planLabel, subscriptionStatusLabel } from './subscription-copy';

export type PaywallPlanId = 'monthly' | 'yearly';

type PaywallBenefit = { id: string; label: string };

/**
 * Premium / paywall shell (E4.1 + conversion §1).
 * Real purchase will open the native StoreKit / Play Billing sheet via RevenueCat —
 * never a redirect to an App Store product webpage. Purchase CTAs stay structured
 * and honest until that wiring lands.
 */
@Component({
  selector: 'app-cellar-paywall-page',
  standalone: true,
  imports: [RouterLink, CellarShell, BottlePhoto],
  templateUrl: './cellar-paywall.page.html',
})
export class CellarPaywallPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly collection = inject(CollectionService);
  private readonly share = inject(NativeShareService);

  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly reason = signal<'limit' | 'jauge' | 'photo' | 'premium' | 'locked'>('limit');
  readonly selectedPlan = signal<PaywallPlanId>('yearly');
  /** Optional vignettes when reason=limit (existing list API, no new endpoint). */
  readonly vignettes = signal<UserBottle[]>([]);

  readonly monthly = PLANS.monthly;
  readonly yearly = PLANS.yearly;
  readonly limit = FREE_BOTTLE_LIMIT;
  /** Marketing equiv. 39,99 / 12 ≈ 3,33 — OK for paywall display. */
  readonly yearlyPerMonthLabel = '3,33';
  readonly manageSubscriptionsUrl = this.share.subscriptionManageUrl();
  readonly cguUrl = 'https://atasoif.fr/cgu';
  readonly privacyUrl = 'https://atasoif.fr/confidentialite';

  readonly isPremium = computed(() => this.freemium()?.entitlement === true);
  readonly statusLine = computed(() => subscriptionStatusLabel(this.freemium()));
  readonly currentPlanLabel = computed(() => planLabel(this.freemium()?.plan ?? null));

  readonly trialDays = computed(() =>
    this.selectedPlan() === 'yearly' ? this.yearly.trialDays : this.monthly.trialDays,
  );

  readonly ctaLabel = computed(
    () => `Essayer ${this.trialDays()} jours gratuits`,
  );

  readonly legalLine = computed(() => {
    const plan = this.selectedPlan() === 'yearly' ? this.yearly : this.monthly;
    const price =
      plan.interval === 'year'
        ? `${this.formatEur(plan.priceEur)} €/an`
        : `${this.formatEur(plan.priceEur)} €/mois`;
    return `Après ${plan.trialDays} jours, ${price}. Renouvellement automatique · annulable à tout moment depuis ton store.`;
  });

  readonly benefits = computed((): PaywallBenefit[] => {
    const all: PaywallBenefit[] = [
      { id: 'cave', label: 'Cave illimitée' },
      { id: 'photo', label: 'Ta photo perso' },
      { id: 'jauge', label: 'La jauge de niveau' },
    ];
    const reason = this.reason();
    const priority =
      reason === 'photo' ? 'photo' : reason === 'jauge' ? 'jauge' : 'cave';
    return [...all].sort((a, b) => {
      if (a.id === priority) return -1;
      if (b.id === priority) return 1;
      return 0;
    });
  });

  readonly showVignettes = computed(
    () =>
      !this.isPremium() &&
      this.reason() === 'limit' &&
      this.vignettes().length > 0,
  );

  readonly nameOf = displayName;
  readonly photoOf = displayPhotoUrl;

  ngOnInit(): void {
    const raw = this.route.snapshot.queryParamMap.get('reason');
    if (
      raw === 'jauge' ||
      raw === 'photo' ||
      raw === 'premium' ||
      raw === 'limit' ||
      raw === 'locked'
    ) {
      this.reason.set(raw);
    }

    if (this.reason() === 'limit') {
      this.collection.list({ limit: FREE_BOTTLE_LIMIT }).subscribe({
        next: (body) => {
          this.freemium.set(body.meta.freemium);
          this.vignettes.set(body.data.slice(0, FREE_BOTTLE_LIMIT));
        },
        error: () => {
          this.freemium.set(null);
        },
      });
    } else {
      this.collection.freemium().subscribe({
        next: (meta) => this.freemium.set(meta),
        error: () => this.freemium.set(null),
      });
    }
  }

  get headline(): string {
    if (this.isPremium()) {
      return 'Ton abonnement';
    }
    switch (this.reason()) {
      case 'jauge':
        return 'La jauge, c’est premium';
      case 'photo':
        return 'Ta photo perso, c’est premium';
      case 'premium':
        return 'Cette touche est premium';
      case 'locked':
        return 'Tes souvenirs t’attendent';
      default:
        return 'Cave pleine';
    }
  }

  get lead(): string {
    if (this.isPremium()) {
      const plan = this.currentPlanLabel();
      return plan
        ? `Tu es en Premium ${plan.toLowerCase()}. Photo perso, jauge et cave sans limite sont débloqués.`
        : 'Tu es Premium. Photo perso, jauge et cave sans limite sont débloqués.';
    }
    switch (this.reason()) {
      case 'jauge':
        return 'Suis le niveau de tes bouteilles dès que tu passes premium.';
      case 'photo':
        return 'Remplace la photo catalogue par la tienne.';
      case 'premium':
        return 'Photo perso et jauge restent réservées aux abonnés.';
      case 'locked':
        return 'Repasse premium pour rouvrir tes bouteilles en sommeil — prix, lieux, notes et avis.';
      default:
        return `Cave pleine · passe premium pour continuer au-delà de ${this.limit} bouteilles.`;
    }
  }

  selectPlan(plan: PaywallPlanId): void {
    this.selectedPlan.set(plan);
  }

  formatEur(value: number): string {
    if (value % 1 === 0) {
      return String(value);
    }
    return value.toFixed(2).replace('.', ',');
  }

  /** Placeholder until RevenueCat restorePurchases() is wired. */
  onRestorePlaceholder(): void {
    // Intentionally no-op: keeps the control in the IAP layout without fake success.
  }
}
