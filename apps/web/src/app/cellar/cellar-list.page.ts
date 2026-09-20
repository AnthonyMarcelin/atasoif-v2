import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { BottlePhoto } from './bottle-photo';
import { cellarErrorMessage } from './cellar-errors';
import { CellarShell } from './cellar-shell';
import {
  displayBrand,
  displayCategory,
  displayName,
  displayPhotoUrl,
  type FreemiumMeta,
  type UserBottle,
} from './cellar.types';
import { CollectionService } from './collection.service';

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

  readonly filters: Array<{ slug: string | null; label: string }> = [
    { slug: null, label: 'Tout' },
    { slug: 'whisky', label: 'Whisky' },
    { slug: 'rhum', label: 'Rhum' },
    { slug: 'beer', label: 'Bière' },
    { slug: 'wine', label: 'Vin' },
    { slug: 'gin', label: 'Gin' },
    { slug: 'other', label: 'Autre' },
  ];

  readonly nameOf = displayName;
  readonly brandOf = displayBrand;
  readonly photoOf = displayPhotoUrl;
  readonly categoryOf = displayCategory;

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
