import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { memorySheetCompleteness, type MemorySheetCompleteness } from '@atasoif/shared';
import { finalize, firstValueFrom } from 'rxjs';

import { BottlePhoto } from './bottle-photo';
import { cellarErrorMessage } from './cellar-errors';
import { CellarShell } from './cellar-shell';
import {
  displayAbv,
  displayBrand,
  displayCategory,
  displayName,
  displayOrigin,
  displayPhotoUrl,
  displayVolumeMl,
  fillLevelLabel,
  formatAbv,
  formatBottleMeta,
  formatVolumeCl,
  type FreemiumMeta,
  type UserBottle,
} from './cellar.types';
import { CollectionService } from './collection.service';
import { cellarEmptyKind } from './freemium-counter';
import { ShareCardService } from './share-card.service';

@Component({
  selector: 'app-cellar-list-page',
  standalone: true,
  imports: [RouterLink, CellarShell, BottlePhoto],
  templateUrl: './cellar-list.page.html',
})
export class CellarListPage implements OnInit {
  private readonly collection = inject(CollectionService);
  private readonly router = inject(Router);
  private readonly shareCards = inject(ShareCardService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly bottles = signal<UserBottle[]>([]);
  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly lockedCount = signal(0);
  readonly category = signal<string | null>(null);
  readonly localQuery = signal('');
  readonly sharing = signal(false);
  readonly shareMessage = signal<string | null>(null);
  readonly shareError = signal<string | null>(null);
  /** Header counter uses freemium meta (lifetime creates), never `bottles().length`. */
  readonly emptyKind = computed(() => cellarEmptyKind(this.freemium()));

  readonly visibleBottles = computed(() => {
    const q = this.localQuery().trim().toLowerCase();
    if (!q) {
      return this.bottles();
    }
    return this.bottles().filter((entry) => {
      const hay = [
        displayName(entry),
        displayBrand(entry) ?? '',
        entry.boughtAt ?? '',
        displayOrigin(entry) ?? '',
        displayCategory(entry)?.name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  readonly filters: Array<{ slug: string | null; label: string }> = [
    { slug: null, label: 'Tout' },
    { slug: 'whisky', label: 'Whisky' },
    { slug: 'rhum', label: 'Rhum' },
    { slug: 'beer', label: 'Bière' },
    { slug: 'wine', label: 'Vin' },
    { slug: 'gin', label: 'Gin' },
    { slug: 'cognac', label: 'Cognac' },
    { slug: 'vodka', label: 'Vodka' },
    { slug: 'liqueur', label: 'Liqueur' },
    { slug: 'other', label: 'Autre' },
  ];

  readonly nameOf = displayName;
  readonly brandOf = displayBrand;
  readonly photoOf = displayPhotoUrl;
  readonly categoryOf = displayCategory;
  readonly levelOf = (entry: UserBottle) => fillLevelLabel(entry.fillLevel ?? 100);

  ngOnInit(): void {
    this.load();
  }

  setCategory(slug: string | null): void {
    if (this.category() === slug) {
      return;
    }
    this.category.set(slug);
    this.load();
  }

  onLocalQuery(value: string): void {
    this.localQuery.set(value);
  }

  countFor(slug: string | null): number | null {
    if (this.loading() || this.error()) {
      return null;
    }
    if (slug === null) {
      const n = this.bottles().length;
      return n > 0 ? n : null;
    }
    // Counts only meaningful on the unfiltered list; skip when a category filter is active.
    if (this.category() !== null) {
      return null;
    }
    const n = this.bottles().filter((b) => b.bottle?.category?.slug === slug).length;
    return n > 0 ? n : null;
  }

  metaOf(entry: UserBottle): string {
    return formatBottleMeta([
      displayOrigin(entry)?.toUpperCase() ?? null,
      formatAbv(displayAbv(entry)),
      formatVolumeCl(displayVolumeMl(entry)),
    ]);
  }

  memoryOf(entry: UserBottle): MemorySheetCompleteness {
    return memorySheetCompleteness({
      pricePaid: entry.pricePaid,
      boughtAt: entry.boughtAt,
      note: entry.note,
      review: entry.review,
    });
  }

  onCardActivate(entry: UserBottle, event: Event): void {
    if (!entry.locked) {
      return;
    }
    event.preventDefault();
    void this.router.navigate(['/cave/premium'], { queryParams: { reason: 'locked' } });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const category = this.category() ?? undefined;
    this.collection
      .list({ category, limit: 50 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (body) => {
          this.bottles.set(body.data);
          this.freemium.set(body.meta.freemium);
          this.lockedCount.set(body.meta.lockedCount ?? body.data.filter((b) => b.locked).length);
        },
        error: (err: unknown) => {
          this.error.set(cellarErrorMessage(err, 'Impossible de charger ta cave. Réessaie.'));
        },
      });
  }

  async shareCave(): Promise<void> {
    if (this.sharing() || this.bottles().length === 0) {
      return;
    }
    this.sharing.set(true);
    this.shareMessage.set(null);
    this.shareError.set(null);
    try {
      let bottles = this.bottles();
      // Share the full cellar even when a category chip is active.
      if (this.category() !== null) {
        const body = await firstValueFrom(this.collection.list({ limit: 100 }));
        bottles = body.data;
      }
      const result = await this.shareCards.shareCave(bottles);
      if (result === 'copied') {
        this.shareMessage.set('Lien https copié · ouvre ton app pour envoyer la carte.');
      } else if (result === 'shown') {
        this.shareMessage.set('Partage indisponible · copie le lien depuis Amis.');
      } else {
        this.shareMessage.set('Carte prête · choisis où la poster.');
      }
    } catch (err: unknown) {
      this.shareError.set(cellarErrorMessage(err, 'Partage impossible. Réessaie.'));
    } finally {
      this.sharing.set(false);
    }
  }
}
