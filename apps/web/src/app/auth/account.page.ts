import { NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../core/auth/api-error';
import { AuthService } from '../core/auth/auth.service';
import { controlErrorMessage, pseudoValidators } from './auth-validators';

@Component({
  selector: 'app-account-page',
  imports: [NgClass, ReactiveFormsModule, RouterLink],
  templateUrl: './account.page.html',
})
export class AccountPage implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly loggedOut = signal(false);
  readonly loading = signal(true);
  readonly loggingOut = signal(false);
  readonly saving = signal(false);
  readonly savedOk = signal(false);
  readonly formError = signal<string | null>(null);
  readonly focusedField = signal<string | null>(null);

  readonly form = this.fb.group({
    pseudo: ['', pseudoValidators],
    isPublic: [false],
  });

  ngOnInit(): void {
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
          this.loggedOut.set(true);
          void this.router.navigateByUrl('/auth/login');
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
