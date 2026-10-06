import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FREE_BOTTLE_LIMIT, PLANS } from '@atasoif/shared';

import { CellarShell } from './cellar-shell';
import type { FreemiumMeta } from './cellar.types';
import { CollectionService } from './collection.service';
import { NativeShareService } from './native-share.service';
import { planLabel, subscriptionStatusLabel } from './subscription-copy';

/**
 * Premium / paywall shell (E4.1).
 * Real purchase will open the native StoreKit / Play Billing sheet via RevenueCat —
 * never a redirect to an App Store product webpage. Purchase CTAs stay structured
 * and honest until that wiring lands.
 */
@Component({
  selector: 'app-cellar-paywall-page',
  standalone: true,
  imports: [RouterLink, CellarShell],
  templateUrl: './cellar-paywall.page.html',
})
export class CellarPaywallPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly collection = inject(CollectionService);
  private readonly share = inject(NativeShareService);

  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly reason = signal<'limit' | 'jauge' | 'photo' | 'premium'>('limit');

  readonly monthly = PLANS.monthly;
  readonly yearly = PLANS.yearly;
  readonly limit = FREE_BOTTLE_LIMIT;
  readonly manageSubscriptionsUrl = this.share.subscriptionManageUrl();

  readonly isPremium = computed(() => this.freemium()?.entitlement === true);
  readonly statusLine = computed(() => subscriptionStatusLabel(this.freemium()));
  readonly currentPlanLabel = computed(() => planLabel(this.freemium()?.plan ?? null));

  ngOnInit(): void {
    const raw = this.route.snapshot.queryParamMap.get('reason');
    if (raw === 'jauge' || raw === 'photo' || raw === 'premium' || raw === 'limit') {
      this.reason.set(raw);
    }

    this.collection.freemium().subscribe({
      next: (meta) => this.freemium.set(meta),
      error: () => this.freemium.set(null),
    });
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
      default:
        return `Cave pleine · passe premium pour continuer au-delà de ${this.limit} bouteilles.`;
    }
  }

  /** Placeholder until RevenueCat restorePurchases() is wired. */
  onRestorePlaceholder(): void {
    // Intentionally no-op: keeps the control in the IAP layout without fake success.
  }
}
