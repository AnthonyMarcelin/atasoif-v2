import { NgClass } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { BottlePhoto } from './bottle-photo';
import { apiErrorFeature, cellarErrorMessage, isFreemiumGateError } from './cellar-errors';
import { CellarShell } from './cellar-shell';
import { shelfPhotoRejection } from './shelf-photo';
import {
  displayBrand,
  displayName,
  displayPhotoUrl,
  type FreemiumMeta,
  type UserBottle,
} from './cellar.types';
import { CollectionService } from './collection.service';
import { FillGauge } from './fill-gauge';

@Component({
  selector: 'app-cellar-detail-page',
  standalone: true,
  imports: [NgClass, ReactiveFormsModule, RouterLink, CellarShell, BottlePhoto, FillGauge],
  templateUrl: './cellar-detail.page.html',
})
export class CellarDetailPage implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly collection = inject(CollectionService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly editing = signal(false);
  readonly confirmDelete = signal(false);
  readonly uploadingPhoto = signal(false);
  readonly error = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly levelError = signal<string | null>(null);
  readonly photoError = signal<string | null>(null);
  readonly savedOk = signal(false);
  readonly fillSync = signal(0);
  readonly entry = signal<UserBottle | null>(null);
  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly focusedField = signal<string | null>(null);

  readonly form = this.fb.group({
    nameOverride: ['', [Validators.maxLength(255)]],
    brandOverride: ['', [Validators.maxLength(255)]],
    boughtAt: ['', [Validators.required, Validators.maxLength(255)]],
    pricePaid: ['' as string],
    note: ['' as string],
    review: ['', [Validators.maxLength(5000)]],
  });

  readonly nameOf = displayName;
  readonly brandOf = displayBrand;
  readonly photoOf = displayPhotoUrl;

  private levelSaveSeq = 0;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.loading.set(false);
      this.error.set('Bouteille introuvable.');
      return;
    }
    this.load(id);
  }

  load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.collection
      .get(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (body) => {
          this.entry.set(body.data);
          this.freemium.set(body.meta.freemium);
          this.patchForm(body.data);
        },
        error: (err: unknown) => {
          this.error.set(cellarErrorMessage(err, 'Impossible de charger cette bouteille.'));
        },
      });
  }

  startEdit(): void {
    const current = this.entry();
    if (!current) {
      return;
    }
    this.patchForm(current);
    this.formError.set(null);
    this.savedOk.set(false);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.formError.set(null);
    const current = this.entry();
    if (current) {
      this.patchForm(current);
    }
  }

  onSave(): void {
    const current = this.entry();
    if (!current) {
      return;
    }
    this.formError.set(null);
    this.savedOk.set(false);
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

    const catalogName = current.bottle?.name ?? '';
    const catalogBrand = current.bottle?.brand ?? '';
    const nameTrim = raw.nameOverride.trim();
    const brandTrim = raw.brandOverride.trim();

    this.saving.set(true);
    this.collection
      .update(current.id, {
        boughtAt,
        pricePaid,
        note,
        review: raw.review.trim() ? raw.review.trim() : null,
        nameOverride: nameTrim && nameTrim !== catalogName ? nameTrim : null,
        brandOverride: brandTrim && brandTrim !== catalogBrand ? brandTrim : null,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (body) => {
          this.entry.set(body.data);
          this.freemium.set(body.meta.freemium);
          this.editing.set(false);
          this.savedOk.set(true);
        },
        error: (err: unknown) => {
          if (isFreemiumGateError(err)) {
            void this.router.navigate(['/cave/premium'], {
              queryParams: { reason: 'premium' },
            });
            return;
          }
          this.formError.set(cellarErrorMessage(err, 'Enregistrement impossible. Réessaie.'));
        },
      });
  }

  onFillLevel(level: number): void {
    const current = this.entry();
    if (!current) {
      return;
    }
    if (this.freemium()?.entitlement !== true) {
      this.onLockedGauge();
      return;
    }
    if (level === current.fillLevel) {
      return;
    }

    this.levelError.set(null);
    const seq = ++this.levelSaveSeq;
    this.collection.update(current.id, { fillLevel: level }).subscribe({
      next: (body) => {
        if (seq !== this.levelSaveSeq) {
          return;
        }
        this.entry.set(body.data);
        this.freemium.set(body.meta.freemium);
      },
      error: (err: unknown) => {
        if (seq !== this.levelSaveSeq) {
          return;
        }
        this.fillSync.update((n) => n + 1);
        if (isFreemiumGateError(err)) {
          this.goPremium(apiErrorFeature(err) === 'photoOverride' ? 'photo' : 'jauge');
          return;
        }
        this.levelError.set(cellarErrorMessage(err, 'Niveau impossible à enregistrer. Réessaie.'));
      },
    });
  }

  onLockedGauge(): void {
    this.goPremium('jauge');
  }

  onPhotoSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }
    this.submitShelfPhoto(file);
  }

  submitShelfPhoto(file: File): void {
    const current = this.entry();
    if (!current) {
      return;
    }
    if (this.freemium()?.entitlement !== true) {
      this.goPremium('photo');
      return;
    }

    const rejection = shelfPhotoRejection(file);
    if (rejection) {
      this.photoError.set(rejection);
      return;
    }

    this.photoError.set(null);
    this.uploadingPhoto.set(true);
    this.collection
      .uploadPhoto(current.id, file)
      .pipe(finalize(() => this.uploadingPhoto.set(false)))
      .subscribe({
        next: (body) => {
          this.entry.set(body.data);
          this.freemium.set(body.meta.freemium);
          this.savedOk.set(true);
        },
        error: (err: unknown) => {
          if (isFreemiumGateError(err)) {
            this.goPremium(apiErrorFeature(err) === 'fillLevel' ? 'jauge' : 'photo');
            return;
          }
          this.photoError.set(cellarErrorMessage(err, 'Photo impossible à envoyer. Réessaie.'));
        },
      });
  }

  askDelete(): void {
    this.confirmDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmDelete.set(false);
  }

  confirmDeleteAction(): void {
    const current = this.entry();
    if (!current || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.collection
      .delete(current.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/cave');
        },
        error: (err: unknown) => {
          this.confirmDelete.set(false);
          this.error.set(cellarErrorMessage(err, 'Suppression impossible. Réessaie.'));
        },
      });
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

  private patchForm(entry: UserBottle): void {
    this.form.reset({
      nameOverride: entry.nameOverride ?? entry.bottle?.name ?? '',
      brandOverride: entry.brandOverride ?? entry.bottle?.brand ?? '',
      boughtAt: entry.boughtAt ?? '',
      pricePaid: entry.pricePaid !== null && entry.pricePaid !== undefined ? String(entry.pricePaid) : '',
      note: entry.note !== null && entry.note !== undefined ? String(entry.note) : '',
      review: entry.review ?? '',
    });
  }

  private goPremium(reason: 'jauge' | 'photo' | 'limit' | 'premium'): void {
    void this.router.navigate(['/cave/premium'], { queryParams: { reason } });
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
