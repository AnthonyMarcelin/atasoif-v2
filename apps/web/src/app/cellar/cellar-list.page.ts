import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

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
  formatPriceEur,
  formatVolumeCl,
  type FreemiumMeta,
  type UserBottle,
} from './cellar.types';
import { CollectionService } from './collection.service';
import { cellarEmptyKind } from './freemium-counter';

@Component({
  selector: 'app-cellar-list-page',
  standalone: true,
  imports: [RouterLink, CellarShell, BottlePhoto],
  templateUrl: './cellar-list.page.html',
})
export class CellarListPage implements OnInit {
  private readonly collection = inject(CollectionService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly bottles = signal<UserBottle[]>([]);
  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly category = signal<string | null>(null);
  readonly localQuery = signal('');
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
  readonly levelOf = (entry: UserBottle) => fillLevelLabel(entry.fillLevel);

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

  memoryLine(entry: UserBottle): string {
    const price = formatPriceEur(entry.pricePaid);
    const place = entry.boughtAt?.trim() || null;
    if (price && place) {
      return `${price} · ${place}`;
    }
    return price || place || 'Souvenir à compléter';
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
        },
        error: (err: unknown) => {
          this.error.set(cellarErrorMessage(err, 'Impossible de charger ta cave. Réessaie.'));
        },
      });
  }
}
