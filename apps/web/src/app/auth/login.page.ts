import { NgClass } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../core/auth/api-error';
import { AuthService } from '../core/auth/auth.service';
import { AuthTabs } from './auth-tabs';
import { controlErrorMessage, emailValidators, passwordValidators } from './auth-validators';

const OAUTH_ERROR_COPY: Record<string, string> = {
  google_denied: 'Connexion Google annulée.',
  google_state: 'Session Google expirée. Réessaie.',
  google_error: 'Google a renvoyé une erreur. Réessaie.',
  google_email: 'Google n’a pas fourni d’e-mail utilisable.',
};

@Component({
  selector: 'app-login-page',
  imports: [NgClass, ReactiveFormsModule, RouterLink, AuthTabs],
  templateUrl: './login.page.html',
})
export class LoginPage implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly showPassword = signal(false);
  readonly submittedOk = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly focusedField = signal<string | null>(null);

  readonly form = this.fb.group({
    email: ['', emailValidators],
    password: ['', passwordValidators],
  });

  ngOnInit(): void {
    const oauthError = this.route.snapshot.queryParamMap.get('oauthError');
    if (oauthError) {
      this.formError.set(
        OAUTH_ERROR_COPY[oauthError] ?? 'Connexion Google impossible. Réessaie.',
      );
    }
  }

  errorFor(name: 'email' | 'password'): string | null {
    const labels = {
      email: "L'e-mail",
      password: 'Le mot de passe',
    } as const;
    return controlErrorMessage(this.form.controls[name], labels[name]);
  }

  onSubmit(): void {
    this.submittedOk.set(false);
    this.formError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth
      .login({ email, password })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.submittedOk.set(true);
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/me';
          void this.router.navigateByUrl(this.auth.postAuthPath(returnUrl));
        },
        error: (err: unknown) => {
          this.formError.set(
            apiErrorMessage(err, 'Email ou mot de passe incorrect. Réessaie.'),
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
