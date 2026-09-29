import { NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { isWineCategorySlug, readWineAttr, WINE_ATTR_LIMITS } from '@atasoif/shared';

import { BottlePhoto } from './bottle-photo';
import { CatalogService, looksLikeBarcode } from './catalog.service';
import { cellarErrorMessage, isFreemiumGateError } from './cellar-errors';
import { CellarShell } from './cellar-shell';
import type { CatalogBottle, CatalogCategory, FreemiumMeta } from './cellar.types';
import { CollectionService } from './collection.service';
import { wineCatalogAttrs, wineOverrideFromForm, wineOverrideHasValue } from './wine-attrs';

type AddStep = 'search' | 'confirm';

@Component({
  selector: 'app-cellar-add-page',
  standalone: true,
  imports: [NgClass, ReactiveFormsModule, RouterLink, CellarShell, BottlePhoto],
  templateUrl: './cellar-add.page.html',
})
export class CellarAddPage implements OnInit, OnDestroy {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly query$ = new Subject<string>();

  readonly step = signal<AddStep>('search');
  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly searching = signal(false);
  readonly results = signal<CatalogBottle[]>([]);
  readonly searchError = signal<string | null>(null);
  readonly barcodeMiss = signal(false);
  readonly selected = signal<CatalogBottle | null>(null);
  readonly isMiss = signal(false);
  readonly categories = signal<CatalogCategory[]>([]);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly focusedField = signal<string | null>(null);
  readonly wineLimits = WINE_ATTR_LIMITS;

  readonly searchControl = this.fb.control('');

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    brand: ['', [Validators.maxLength(255)]],
    categoryId: [0 as number, [Validators.required, Validators.min(1)]],
    appellation: ['', [Validators.maxLength(WINE_ATTR_LIMITS.appellation)]],
    grape: ['', [Validators.maxLength(WINE_ATTR_LIMITS.grape)]],
    vintage: ['', [Validators.maxLength(WINE_ATTR_LIMITS.vintage)]],
    boughtAt: ['', [Validators.required, Validators.maxLength(255)]],
    pricePaid: ['' as string],
    note: ['' as string],
    review: ['', [Validators.maxLength(5000)]],
  });

  ngOnInit(): void {
    this.collection.freemium().subscribe({
      next: (meta) => this.freemium.set(meta),
      error: () => this.freemium.set(null),
    });

    this.catalog.categories().subscribe({
      next: (rows: CatalogCategory[]) => this.categories.set(rows),
      error: () => this.categories.set([]),
    });

    this.query$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((raw) => {
          const q = raw.trim();
          this.searchError.set(null);
          this.barcodeMiss.set(false);

          if (!q) {
            this.results.set([]);
            this.searching.set(false);
            return of({ kind: 'empty' as const });
          }

          this.searching.set(true);

          if (looksLikeBarcode(q)) {
            return this.catalog.lookupBarcode(q).pipe(
              switchMap((bottle) => of({ kind: 'barcode' as const, bottle })),
              catchError((err: unknown) => {
                const code =
                  err && typeof err === 'object' && 'error' in err
                    ? (err as { error?: { code?: string } }).error?.code
                    : null;
                if (code === 'E_BOTTLE_NOT_FOUND') {
                  this.barcodeMiss.set(true);
                  this.results.set([]);
                  return of({ kind: 'barcode-miss' as const });
                }
                this.searchError.set(
                  cellarErrorMessage(err, 'Recherche code-barres impossible. Réessaie.'),
                );
                return of({ kind: 'error' as const });
              }),
              finalize(() => this.searching.set(false)),
            );
          }

          return this.catalog.search(q).pipe(
            switchMap((body: { data: CatalogBottle[] }) =>
              of({ kind: 'search' as const, data: body.data }),
            ),
            catchError((err: unknown) => {
              this.searchError.set(cellarErrorMessage(err, 'Recherche impossible. Réessaie.'));
              return of({ kind: 'error' as const });
            }),
            finalize(() => this.searching.set(false)),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((outcome) => {
        if (outcome.kind === 'search') {
          this.results.set(outcome.data);
        } else if (outcome.kind === 'barcode') {
          this.results.set([outcome.bottle]);
        } else if (outcome.kind === 'empty' || outcome.kind === 'barcode-miss') {
          this.results.set([]);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onQueryInput(value: string): void {
    this.searchControl.setValue(value);
    this.query$.next(value);
  }

  pickHit(bottle: CatalogBottle): void {
    this.selected.set(bottle);
    this.isMiss.set(false);
    this.form.reset({
      name: bottle.name,
      brand: bottle.brand ?? '',
      categoryId: bottle.categoryId,
      appellation: readWineAttr(bottle.attrs, 'appellation'),
      grape: readWineAttr(bottle.attrs, 'grape'),
      vintage: readWineAttr(bottle.attrs, 'vintage'),
      boughtAt: '',
      pricePaid: '',
      note: '',
      review: '',
    });
    this.formError.set(null);
    this.step.set('confirm');
  }

  startMiss(): void {
    const q = this.searchControl.value.trim();
    const cats = this.categories();
    const defaultCategoryId = cats[0]?.id ?? 0;
    this.selected.set(null);
    this.isMiss.set(true);
    this.form.reset({
      name: looksLikeBarcode(q) ? '' : q,
      brand: '',
      categoryId: defaultCategoryId,
      appellation: '',
      grape: '',
      vintage: '',
      boughtAt: '',
      pricePaid: '',
      note: '',
      review: '',
    });
    this.formError.set(null);
    this.step.set('confirm');
  }

  backToSearch(): void {
    this.step.set('search');
    this.formError.set(null);
  }

  onSubmit(): void {
    this.formError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }

    const raw = this.form.getRawValue();
    const boughtAt = raw.boughtAt.trim();
    if (!boughtAt) {
      this.formError.set('Indique où tu l’as achetée.');
      return;
    }

    const pricePaid = this.parseOptionalNumber(raw.pricePaid);
    const note = this.parseOptionalNumber(raw.note);
    if (pricePaid === 'invalid' || note === 'invalid') {
      this.formError.set('Prix ou note invalide.');
      return;
    }

    const selected = this.selected();
    const wineEntered = {
      appellation: raw.appellation,
      grape: raw.grape,
      vintage: raw.vintage,
    };
    const wine = this.showWineFields();
    const wineOverride = wine ? wineOverrideFromForm(wineEntered, selected?.attrs) : null;
    const catalogWineAttrs = wine && this.isMiss() ? wineCatalogAttrs(wineEntered) : undefined;
    const payload =
      selected && !this.isMiss()
        ? {
            bottleId: selected.id,
            boughtAt,
            ...(pricePaid !== null ? { pricePaid } : {}),
            ...(note !== null ? { note } : {}),
            ...(raw.review.trim() ? { review: raw.review.trim() } : {}),
            ...(raw.name.trim() && raw.name.trim() !== selected.name
              ? { nameOverride: raw.name.trim() }
              : {}),
            ...(raw.brand.trim() && raw.brand.trim() !== (selected.brand ?? '')
              ? { brandOverride: raw.brand.trim() }
              : {}),
            ...(wineOverride && wineOverrideHasValue(wineOverride)
              ? { attrsOverride: wineOverride }
              : {}),
          }
        : {
            bottle: {
              name: raw.name.trim(),
              ...(raw.brand.trim() ? { brand: raw.brand.trim() } : {}),
              categoryId: Number(raw.categoryId),
              ...(catalogWineAttrs ? { attrs: catalogWineAttrs } : {}),
            },
            boughtAt,
            ...(pricePaid !== null ? { pricePaid } : {}),
            ...(note !== null ? { note } : {}),
            ...(raw.review.trim() ? { review: raw.review.trim() } : {}),
          };

    this.saving.set(true);
    this.collection
      .create(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (body) => {
          void this.router.navigate(['/cave', body.data.id]);
        },
        error: (err: unknown) => {
          if (isFreemiumGateError(err)) {
            void this.router.navigate(['/cave/premium'], {
              queryParams: { reason: 'limit' },
            });
            return;
          }
          this.formError.set(
            cellarErrorMessage(err, 'Impossible d’ajouter cette bouteille. Réessaie.'),
          );
        },
      });
  }

  showWineFields(): boolean {
    if (!this.isMiss()) {
      return isWineCategorySlug(this.selected()?.category?.slug);
    }
    const categoryId = Number(this.form.controls.categoryId.value);
    const category = this.categories().find((row) => row.id === categoryId);
    return isWineCategorySlug(category?.slug);
  }

  setFocused(field: string | null): void {
    this.focusedField.set(field);
  }

  fieldClass(name: string): Record<string, boolean> {
    const control = this.form.get(name);
    return {
      'auth-field': true,
      'is-focused': this.focusedField() === name,
      'is-invalid': !!(control && control.touched && control.invalid),
    };
  }

  private parseOptionalNumber(value: string): number | null | 'invalid' {
    const trimmed = value.trim().replace(',', '.');
    if (!trimmed) {
      return null;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n) || n < 0) {
      return 'invalid';
    }
    return n;
  }
}
