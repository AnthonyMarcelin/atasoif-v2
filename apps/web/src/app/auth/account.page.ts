import { NgClass } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../core/auth/api-error';
import { AuthService } from '../core/auth/auth.service';
import { BiometricAuthService } from '../core/auth/biometric-auth.service';
import { CellarShell } from '../cellar/cellar-shell';
import type { FreemiumMeta } from '../cellar/cellar.types';
import { CollectionService } from '../cellar/collection.service';
import { subscriptionStatusLabel } from '../cellar/subscription-copy';
import { controlErrorMessage, pseudoValidators } from './auth-validators';

@Component({
  selector: 'app-account-page',
  imports: [NgClass, ReactiveFormsModule, RouterLink, CellarShell],
  templateUrl: './account.page.html',
})
export class AccountPage implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly auth = inject(AuthService);
  private readonly biometrics = inject(BiometricAuthService);
  private readonly collection = inject(CollectionService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly loading = signal(true);
  readonly loggingOut = signal(false);
  readonly saving = signal(false);
  readonly savedOk = signal(false);
  readonly formError = signal<string | null>(null);
  readonly focusedField = signal<string | null>(null);
  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly biometricNative = this.biometrics.isNative;
  readonly biometricAvailable = signal(false);
  readonly biometricEnabled = signal(false);
  readonly biometricBusy = signal(false);
  readonly biometricMessage = signal<string | null>(null);
  readonly biometricError = signal(false);

  readonly premiumRowHint = computed(() => {
    const meta = this.freemium();
    if (!meta) {
      return 'Photo perso · jauge · cave sans limite';
    }
    return `${subscriptionStatusLabel(meta)} · photo · jauge`;
  });

  readonly form = this.fb.group({
    pseudo: ['', pseudoValidators],
    isPublic: [false],
  });

  ngOnInit(): void {
    this.reload();
    this.biometricEnabled.set(this.biometrics.isEnabledPreference());
    void this.biometrics.isAvailable().then((ok) => this.biometricAvailable.set(ok));
    this.collection.freemium().subscribe({
      next: (meta) => this.freemium.set(meta),
      error: () => this.freemium.set(null),
    });
  }

  async onBiometricToggle(enabled: boolean): Promise<void> {
    if (this.biometricBusy()) {
      return;
    }
    this.biometricBusy.set(true);
    this.biometricMessage.set(null);
    this.biometricError.set(false);
    try {
      if (!enabled) {
        await this.biometrics.clear();
        this.biometrics.setEnabledPreference(false);
        this.biometricEnabled.set(false);
        this.biometricMessage.set('Biométrie désactivée.');
        return;
      }
      const verified = await this.biometrics.verifyUnlock();
      if (!verified.ok) {
        this.biometricError.set(verified.reason !== 'cancelled');
        this.biometricEnabled.set(false);
        this.biometricMessage.set(
          verified.reason === 'cancelled'
            ? 'Activation annulée.'
            : 'Impossible d’activer Face ID. Réessaie.',
        );
        return;
      }
      this.biometrics.setEnabledPreference(true);
      this.biometricEnabled.set(true);
      this.biometricMessage.set(
        'Biométrie activée. Au retour dans l’app, Face ID déverrouille ta cave.',
      );
    } catch {
      this.biometricError.set(true);
      this.biometricMessage.set('Impossible de mettre à jour la biométrie.');
      this.biometricEnabled.set(this.biometrics.isEnabledPreference());
    } finally {
      this.biometricBusy.set(false);
    }
  }

  reload(): void {
    this.loading.set(true);
    this.formError.set(null);
    this.auth
      .loadProfile()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((profile) => {
        if (!profile) {
          return;
        }
        this.form.reset({
          pseudo: profile.pseudo ?? '',
          isPublic: profile.isPublic,
        });
      });
  }

  errorFor(name: 'pseudo'): string | null {
    return controlErrorMessage(this.form.controls[name], 'Le pseudo');
  }

  onSubmit(): void {
    this.savedOk.set(false);
    this.formError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    const { pseudo, isPublic } = this.form.getRawValue();
    this.auth
      .updateProfile({ pseudo, isPublic })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.savedOk.set(true);
        },
        error: (err: unknown) => {
          this.formError.set(
            apiErrorMessage(err, 'Impossible d’enregistrer ton profil. Réessaie.'),
          );
        },
      });
  }

  logout(): void {
    if (this.loggingOut()) {
      return;
    }
    this.loggingOut.set(true);
    this.auth
      .logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/');
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
}
