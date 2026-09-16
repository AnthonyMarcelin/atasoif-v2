import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../core/auth/api-error';
import { AuthService } from '../core/auth/auth.service';
import { AuthTabs } from './auth-tabs';
import {
  controlErrorMessage,
  emailValidators,
  passwordValidators,
  passwordsMatchValidator,
  pseudoValidators,
} from './auth-validators';
import { evaluatePasswordStrength } from './password-strength';

@Component({
  selector: 'app-register-page',
  imports: [NgClass, ReactiveFormsModule, RouterLink, AuthTabs],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly showPassword = signal(false);
  readonly submittedOk = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly focusedField = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      pseudo: ['', pseudoValidators],
      email: ['', emailValidators],
      password: ['', passwordValidators],
      passwordConfirmation: ['', passwordValidators],
    },
    { validators: passwordsMatchValidator },
  );

  strength() {
    return evaluatePasswordStrength(this.form.controls.password.value);
  }

  errorFor(name: 'pseudo' | 'email' | 'password' | 'passwordConfirmation'): string | null {
    const labels = {
      pseudo: 'Le pseudo',
      email: "L'e-mail",
      password: 'Le mot de passe',
      passwordConfirmation: 'La confirmation',
    } as const;
    return controlErrorMessage(this.form.controls[name], labels[name]);
  }

  mismatchError(): string | null {
    const confirmation = this.form.controls.passwordConfirmation;
    if (!confirmation.touched || !this.form.hasError('passwordsMismatch')) {
      return null;
    }
    return 'Les mots de passe ne correspondent pas.';
  }

  onSubmit(): void {
    this.submittedOk.set(false);
    this.formError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const { pseudo, email, password, passwordConfirmation } = this.form.getRawValue();
    this.auth
      .signup({ pseudo, email, password, passwordConfirmation })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.submittedOk.set(true);
          void this.router.navigateByUrl(this.auth.postAuthPath('/me'));
        },
        error: (err: unknown) => {
          this.formError.set(
            apiErrorMessage(err, "Impossible de créer le compte. Vérifie tes infos."),
          );
        },
      });
  }

  continueWithGoogle(): void {
    this.auth.startGoogleLogin();
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
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
