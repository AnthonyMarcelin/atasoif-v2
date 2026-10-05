import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
  takeUntil,
} from 'rxjs';

import { BottlePhoto } from './bottle-photo';
import { CatalogService } from './catalog.service';
import { cellarErrorMessage } from './cellar-errors';
import { CellarShell } from './cellar-shell';
import {
  catalogBottleMeta,
  catalogBottleTitle,
  type CatalogBottle,
  type CatalogCategory,
  type FreemiumMeta,
  type UserBottle,
} from './cellar.types';
import { CollectionService } from './collection.service';

/** Fallback order when /catalog/categories is slow or empty (matches API seeder). */
const FALLBACK_FILTERS: Array<{ slug: string | null; label: string }> = [
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

@Component({
  selector: 'app-catalog-shell-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CellarShell, BottlePhoto],
  templateUrl: './catalog-shell.page.html',
  styleUrl: './catalog-shell.page.scss',
})
export class CatalogShellPage implements OnInit, OnDestroy {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly query$ = new Subject<string>();

  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly categories = signal<CatalogCategory[]>([]);
  /** `null` = all categories (aligned with Ma cave). */
  readonly filter = signal<string | null>(null);
  readonly searching = signal(false);
  readonly error = signal<string | null>(null);
  readonly inCellar = signal<CatalogBottle[]>([]);
  readonly recent = signal<CatalogBottle[]>([]);
  readonly results = signal<CatalogBottle[]>([]);
  readonly cellarBottleIds = signal<Set<number>>(new Set());
  readonly titleOf = catalogBottleTitle;
  readonly metaOf = catalogBottleMeta;
  readonly searchControl = this.fb.control('');

  readonly filters = signal(FALLBACK_FILTERS);

  ngOnInit(): void {
    this.collection.freemium().subscribe({
      next: (meta) => this.freemium.set(meta),
      error: () => this.freemium.set(null),
    });

    this.catalog.categories().subscribe({
      next: (rows) => {
        this.categories.set(rows);
        if (rows.length > 0) {
          this.filters.set([
            { slug: null, label: 'Tout' },
            ...rows.map((row) => ({ slug: row.slug, label: row.name })),
          ]);
        }
      },
      error: () => this.categories.set([]),
    });

    this.collection.list({ limit: 50 }).subscribe({
      next: (body) => {
        const ids = new Set(body.data.map((row) => row.bottleId).filter(Boolean) as number[]);
        this.cellarBottleIds.set(ids);
        this.inCellar.set(
          body.data
            .map((row) => row.bottle)
            .filter((bottle): bottle is NonNullable<UserBottle['bottle']> => Boolean(bottle))
            .slice(0, 8),
        );
      },
      error: () => {
        this.cellarBottleIds.set(new Set());
        this.inCellar.set([]);
      },
    });

    this.query$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((raw) => {
          const q = raw.trim();
          this.error.set(null);
          if (!q) {
            this.results.set([]);
            this.loadBrowse();
            return of(null);
          }
          this.searching.set(true);
          const category = this.filter() ?? undefined;
          return this.catalog.search(q, 20, { category }).pipe(
            catchError((err: unknown) => {
              this.error.set(cellarErrorMessage(err, 'Catalogue indisponible. Réessaie.'));
              return of({ data: [] as CatalogBottle[] });
            }),
            finalize(() => this.searching.set(false)),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((body) => {
        if (body) {
          this.results.set(body.data);
        }
      });

    this.loadBrowse();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onQueryInput(value: string): void {
    this.searchControl.setValue(value);
    this.query$.next(value);
  }

  setFilter(slug: string | null): void {
    this.filter.set(slug);
    if (this.searchControl.value.trim()) {
      this.query$.next(this.searchControl.value.trim());
    } else {
      this.loadBrowse();
    }
  }

  filterLabel(slug: string | null, label: string): string {
    return label.toUpperCase();
  }

  isInCellar(bottleId: number): boolean {
    return this.cellarBottleIds().has(bottleId);
  }

  openAdd(bottle: CatalogBottle): void {
    void this.router.navigate(['/cave/ajouter'], {
      queryParams: { bottleId: bottle.id },
      state: { bottle },
    });
  }

  private loadBrowse(): void {
    this.searching.set(true);
    const category = this.filter() ?? undefined;
    this.catalog
      .search('', 12, { category, recentDays: 7 })
      .pipe(
        catchError(() => of({ data: [] as CatalogBottle[] })),
        finalize(() => this.searching.set(false)),
      )
      .subscribe((body) => {
        this.recent.set(body.data);
        this.results.set([]);
      });
  }
}
