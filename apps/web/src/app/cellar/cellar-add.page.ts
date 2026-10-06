import { NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs';
import {
  bottleTypesForCategory,
  FILL_LEVEL_DEFAULT,
  FILL_LEVEL_FINISHED,
  isWineCategorySlug,
  memorySheetCompleteness,
  memorySheetMissingHintFr,
  readBottleType,
  readWineAttr,
  WINE_ATTR_LIMITS,
} from '@atasoif/shared';

import { BarcodeScanService } from './barcode-scan.service';
import { BottlePhoto } from './bottle-photo';
import { CatalogService, looksLikeBarcode } from './catalog.service';
import { cellarErrorMessage, isFreemiumGateError } from './cellar-errors';
import { CellarShell } from './cellar-shell';
import { CellarToastService, rewardSlotsToast } from './cellar-toast.service';
import {
  catalogBottleBrand,
  catalogBottleMeta,
  catalogBottleTitle,
  NOTE_MAX,
  type CatalogBottle,
  type CatalogCategory,
  type FreemiumMeta,
} from './cellar.types';
import { CollectionService } from './collection.service';
import { FreemiumCounter } from './freemium-counter';
import { ShelfCameraService } from './shelf-camera.service';
import { shelfPhotoRejection } from './shelf-photo';
import { wineCatalogAttrs, wineOverrideFromForm, wineOverrideHasValue } from './wine-attrs';

type AddStep = 'search' | 'confirm';

@Component({
  selector: 'app-cellar-add-page',
  standalone: true,
  imports: [NgClass, ReactiveFormsModule, RouterLink, CellarShell, BottlePhoto, FreemiumCounter],
  templateUrl: './cellar-add.page.html',
})
export class CellarAddPage implements OnInit, OnDestroy {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly catalog = inject(CatalogService);
  private readonly collection = inject(CollectionService);
  private readonly barcodeScan = inject(BarcodeScanService);
  private readonly shelfCamera = inject(ShelfCameraService);
  private readonly toast = inject(CellarToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly query$ = new Subject<string>();
  private pendingPhotoObjectUrl: string | null = null;

  readonly step = signal<AddStep>('search');
  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly searching = signal(false);
  readonly scanning = signal(false);
  readonly results = signal<CatalogBottle[]>([]);
  readonly searchError = signal<string | null>(null);
  readonly barcodeMiss = signal(false);
  readonly selected = signal<CatalogBottle | null>(null);
  readonly isMiss = signal(false);
  readonly categories = signal<CatalogCategory[]>([]);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly focusedField = signal<string | null>(null);
  /** Premium shelf photo picked on confirm; uploaded after create. */
  readonly pendingPhoto = signal<File | null>(null);
  readonly pendingPhotoPreview = signal<string | null>(null);
  readonly photoError = signal<string | null>(null);
  readonly nativePhotoPick = this.shelfCamera.isNative;
  readonly wineLimits = WINE_ATTR_LIMITS;
  readonly titleOf = catalogBottleTitle;
  readonly brandOf = catalogBottleBrand;
  readonly metaOf = catalogBottleMeta;

  readonly searchControl = this.fb.control('');

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    brand: ['', [Validators.maxLength(255)]],
    categoryId: [0 as number, [Validators.required, Validators.min(1)]],
    bottleType: ['' as string],
    origin: ['', [Validators.maxLength(255)]],
    abv: ['' as string],
    appellation: ['', [Validators.maxLength(WINE_ATTR_LIMITS.appellation)]],
    grape: ['', [Validators.maxLength(WINE_ATTR_LIMITS.grape)]],
    vintage: ['', [Validators.maxLength(WINE_ATTR_LIMITS.vintage)]],
    boughtAt: ['', [Validators.required, Validators.maxLength(255)]],
    boughtOn: ['' as string],
    pricePaid: ['' as string],
    note: ['' as string],
    review: ['', [Validators.maxLength(5000)]],
    fillLevel: [FILL_LEVEL_DEFAULT as number],
  });

  private readonly formSnapshot = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** Soft hint only — never blocks the <30s add path. */
  readonly memoryHint = computed(() => {
    const v = this.formSnapshot();
    return memorySheetMissingHintFr({
      pricePaid: v.pricePaid,
      boughtAt: v.boughtAt,
      note: v.note,
      review: v.review,
    });
  });

  readonly memoryComplete = computed(() => {
    const v = this.formSnapshot();
    return memorySheetCompleteness({
      pricePaid: v.pricePaid,
      boughtAt: v.boughtAt,
      note: v.note,
      review: v.review,
    }).complete;
  });

  readonly productOpen = signal(false);
  readonly fillPresets = [
    { label: 'Scellée', value: FILL_LEVEL_DEFAULT },
    { label: 'Entamée', value: 50 },
    { label: 'Finie', value: FILL_LEVEL_FINISHED },
  ] as const;

  ngOnInit(): void {
    this.collection.freemium().subscribe({
      next: (meta) => this.freemium.set(meta),
      error: () => this.freemium.set(null),
    });

    this.catalog.categories().subscribe({
      next: (rows: CatalogCategory[]) => this.categories.set(rows),
      error: () => this.categories.set([]),
    });

    this.hydrateFromBottleId();

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
    this.clearPendingPhoto();
    this.destroy$.next();
    this.destroy$.complete();
  }

  onQueryInput(value: string): void {
    this.searchControl.setValue(value);
    this.query$.next(value);
  }

  async onScan(): Promise<void> {
    if (this.scanning()) {
      return;
    }
    this.scanning.set(true);
    this.searchError.set(null);
    try {
      const result = await this.barcodeScan.scan();
      if (result.ok) {
        this.onQueryInput(result.barcode);
        return;
      }
      if (result.reason === 'cancelled') {
        return;
      }
      if (result.reason === 'permission') {
        this.searchError.set('Autorise la caméra pour scanner un code-barres.');
        return;
      }
      if (result.reason === 'invalid') {
        this.searchError.set('Code-barres illisible. Tape les chiffres ou réessaie.');
        return;
      }
      // `unavailable` = web build, OR native plugin not linked / not supported.
      this.searchError.set(
        this.barcodeScan.isNative
          ? 'Scan caméra indisponible pour le moment. Colle ou tape le code (8 à 14 chiffres).'
          : 'Scan dispo sur l’app iOS/Android. Ici, colle ou tape le code-barres (8 à 14 chiffres).',
      );
    } finally {
      this.scanning.set(false);
    }
  }

  pickHit(bottle: CatalogBottle): void {
    this.clearPendingPhoto();
    this.selected.set(bottle);
    this.isMiss.set(false);
    this.productOpen.set(false);
    this.form.reset({
      name: catalogBottleTitle(bottle),
      brand: catalogBottleBrand(bottle) ?? '',
      categoryId: bottle.categoryId,
      bottleType: readBottleType(bottle.attrs),
      origin: bottle.origin?.trim() ?? '',
      abv: bottle.abv !== null && bottle.abv !== undefined ? String(bottle.abv) : '',
      appellation: readWineAttr(bottle.attrs, 'appellation'),
      grape: readWineAttr(bottle.attrs, 'grape'),
      vintage: readWineAttr(bottle.attrs, 'vintage'),
      boughtAt: '',
      boughtOn: '',
      pricePaid: '',
      note: '',
      review: '',
      fillLevel: FILL_LEVEL_DEFAULT,
    });
    this.formError.set(null);
    this.step.set('confirm');
  }

  /**
   * Catalogue / « déjà en cave » open `/cave/ajouter?bottleId=` — consume router
   * state when present, otherwise fetch GET /catalog/bottles/:id.
   */
  private hydrateFromBottleId(): void {
    const raw = this.route.snapshot.queryParamMap.get('bottleId');
    const id = raw ? Number(raw) : NaN;
    if (!Number.isInteger(id) || id < 1) {
      return;
    }

    const stateBottle = (
      this.router.getCurrentNavigation()?.extras.state as { bottle?: CatalogBottle } | null
    )?.bottle;
    const historyBottle = (history.state as { bottle?: CatalogBottle } | null)?.bottle;
    const cached = stateBottle ?? historyBottle;
    if (cached && cached.id === id) {
      this.pickHit(cached);
      return;
    }

    this.searching.set(true);
    this.catalog
      .getById(id)
      .pipe(
        catchError((err: unknown) => {
          this.searchError.set(
            cellarErrorMessage(err, 'Impossible de préremplir cette bouteille. Réessaie.'),
          );
          return of(null);
        }),
        finalize(() => this.searching.set(false)),
      )
      .subscribe((bottle) => {
        if (bottle) {
          this.pickHit(bottle);
        }
      });
  }

  startMiss(): void {
    const q = this.searchControl.value.trim();
    const cats = this.categories();
    const defaultCategoryId = cats[0]?.id ?? 0;
    this.clearPendingPhoto();
    this.selected.set(null);
    this.isMiss.set(true);
    this.productOpen.set(true);
    this.form.reset({
      name: looksLikeBarcode(q) ? '' : q,
      brand: '',
      categoryId: defaultCategoryId,
      bottleType: '',
      origin: '',
      abv: '',
      appellation: '',
      grape: '',
      vintage: '',
      boughtAt: '',
      boughtOn: '',
      pricePaid: '',
      note: '',
      review: '',
      fillLevel: FILL_LEVEL_DEFAULT,
    });
    this.formError.set(null);
    this.step.set('confirm');
  }

  /** Returns to step 1 to pick another catalog bottle; souvenir fields are cleared on next pick. */
  backToSearch(): void {
    this.clearPendingPhoto();
    this.step.set('search');
    this.formError.set(null);
  }

  /** Catalog packshot for the confirm step, or local preview of a pending shelf photo. */
  confirmPhotoSrc(): string | null {
    return this.pendingPhotoPreview() ?? this.selected()?.photoUrl ?? null;
  }

  confirmPhotoAlt(): string {
    const bottle = this.selected();
    if (bottle) {
      return this.titleOf(bottle);
    }
    const name = this.form.controls.name.value.trim();
    return name || 'Photo de la bouteille';
  }

  onAddPhotoSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }
    this.setPendingPhoto(file);
  }

  async pickAddPhoto(): Promise<void> {
    if (this.saving()) {
      return;
    }
    if (this.freemium()?.entitlement !== true) {
      void this.router.navigate(['/cave/premium'], { queryParams: { reason: 'photo' } });
      return;
    }
    const result = await this.shelfCamera.pick();
    if (result.ok) {
      this.setPendingPhoto(result.file);
      return;
    }
    if (result.reason === 'cancelled') {
      return;
    }
    if (result.reason === 'permission') {
      this.photoError.set('Autorise la caméra ou la photothèque pour ajouter une photo.');
      return;
    }
    this.photoError.set('Choisis une photo depuis ton appareil.');
  }

  clearPendingPhoto(): void {
    if (this.pendingPhotoObjectUrl) {
      URL.revokeObjectURL(this.pendingPhotoObjectUrl);
      this.pendingPhotoObjectUrl = null;
    }
    this.pendingPhoto.set(null);
    this.pendingPhotoPreview.set(null);
    this.photoError.set(null);
  }

  private setPendingPhoto(file: File): void {
    if (this.freemium()?.entitlement !== true) {
      void this.router.navigate(['/cave/premium'], { queryParams: { reason: 'photo' } });
      return;
    }
    const rejection = shelfPhotoRejection(file);
    if (rejection) {
      this.photoError.set(rejection);
      return;
    }
    if (this.pendingPhotoObjectUrl) {
      URL.revokeObjectURL(this.pendingPhotoObjectUrl);
      this.pendingPhotoObjectUrl = null;
    }
    this.pendingPhotoObjectUrl = URL.createObjectURL(file);
    this.pendingPhoto.set(file);
    this.pendingPhotoPreview.set(this.pendingPhotoObjectUrl);
    this.photoError.set(null);
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
    const note = this.parseOptionalNote(raw.note);
    const abv = this.parseOptionalAbv(raw.abv);
    if (pricePaid === 'invalid') {
      this.formError.set('Prix invalide.');
      return;
    }
    if (note === 'invalid') {
      this.formError.set('La note doit rester entre 0 et 10.');
      return;
    }
    if (abv === 'invalid') {
      this.formError.set('Le degré doit rester entre 0 et 100.');
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
    const typeValue = raw.bottleType.trim();
    const catalogType = typeValue ? { type: typeValue } : undefined;
    const typeOverride =
      typeValue && typeValue !== readBottleType(selected?.attrs) ? { type: typeValue } : null;
    const attrsOverride = {
      ...(wineOverride && wineOverrideHasValue(wineOverride) ? wineOverride : {}),
      ...(typeOverride ?? {}),
    };
    const catalogAttrs = {
      ...(catalogWineAttrs ?? {}),
      ...(catalogType ?? {}),
    };
    const origin = raw.origin.trim();
    const fillLevel = Number(raw.fillLevel);
    const premium = this.freemium()?.entitlement === true;
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
            ...(origin && origin !== (selected.origin ?? '').trim()
              ? { originOverride: origin }
              : {}),
            ...(abv !== null && abv !== selected.abv ? { abvOverride: abv } : {}),
            ...(Object.keys(attrsOverride).length ? { attrsOverride } : {}),
            ...(premium && fillLevel !== FILL_LEVEL_DEFAULT ? { fillLevel } : {}),
          }
        : {
            bottle: {
              name: raw.name.trim(),
              ...(raw.brand.trim() ? { brand: raw.brand.trim() } : {}),
              ...(origin ? { origin } : {}),
              ...(abv !== null ? { abv } : {}),
              categoryId: Number(raw.categoryId),
              ...(Object.keys(catalogAttrs).length ? { attrs: catalogAttrs } : {}),
            },
            boughtAt,
            ...(pricePaid !== null ? { pricePaid } : {}),
            ...(note !== null ? { note } : {}),
            ...(raw.review.trim() ? { review: raw.review.trim() } : {}),
            ...(premium && fillLevel !== FILL_LEVEL_DEFAULT ? { fillLevel } : {}),
          };

    this.saving.set(true);
    const pending = this.pendingPhoto();
    this.collection
      .create(payload)
      .pipe(
        switchMap((body) => {
          if (!pending || !premium) {
            return of(body);
          }
          return this.collection.uploadPhoto(body.data.id, pending).pipe(
            // Bottle already created — land on detail so the user can retry photo.
            catchError(() => of(body)),
          );
        }),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (body) => {
          this.clearPendingPhoto();
          const rewards = body.meta.rewardsGranted;
          if (rewards?.length) {
            const slots = rewards.reduce((sum, row) => sum + Number(row.slots || 0), 0);
            if (slots > 0) {
              this.toast.show(rewardSlotsToast(slots));
            }
          }
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

  currentCategorySlug(): string | null {
    if (!this.isMiss()) {
      return this.selected()?.category?.slug ?? null;
    }
    const categoryId = Number(this.form.controls.categoryId.value);
    return this.categories().find((row) => row.id === categoryId)?.slug ?? null;
  }

  typeOptions(): readonly string[] {
    return bottleTypesForCategory(this.currentCategorySlug());
  }

  setFillLevel(value: number): void {
    this.form.controls.fillLevel.setValue(value);
  }

  toggleProductOpen(): void {
    this.productOpen.update((open) => !open);
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

  private parseOptionalAbv(value: string): number | null | 'invalid' {
    const n = this.parseOptionalNumber(value);
    if (n === null || n === 'invalid') {
      return n;
    }
    if (n > 100) {
      return 'invalid';
    }
    return n;
  }

  private parseOptionalNote(value: string): number | null | 'invalid' {
    const n = this.parseOptionalNumber(value);
    if (n === null || n === 'invalid') {
      return n;
    }
    if (n > NOTE_MAX) {
      return 'invalid';
    }
    return n;
  }
}
