import { NgClass } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../core/auth/api-error';
import { AuthService } from '../core/auth/auth.service';
import { BiometricAuthService } from '../core/auth/biometric-auth.service';
import { safeInternalPath } from '../core/auth/safe-internal-path';
import { SessionGate } from '../core/auth/session-gate';
import { StoreReviewBypass } from '../core/store-review-bypass';
import { AuthTabs } from './auth-tabs';
import { controlErrorMessage, emailValidators, passwordValidators } from './auth-validators';

const OAUTH_ERROR_COPY: Record<string, string> = {
  google_denied: 'Connexion Google annulée.',
  google_state: 'Session Google expirée. Réessaie.',
  google_error: 'Google a renvoyé une erreur. Réessaie.',
  google_email: 'Google n’a pas fourni d’e-mail utilisable.',
  google_unverified:
    'Cet e-mail a déjà un compte non confirmé. Valide le lien reçu par mail, puis réessaie Google.',
  facebook_denied: 'Connexion Facebook annulée.',
  facebook_state: 'Session Facebook expirée. Réessaie.',
  facebook_error: 'Facebook a renvoyé une erreur. Réessaie.',
  facebook_email: 'Facebook n’a pas fourni d’e-mail utilisable.',
  facebook_unverified:
    'Cet e-mail a déjà un compte non confirmé. Valide le lien reçu par mail, puis réessaie Facebook.',
  apple_denied: 'Connexion Apple annulée.',
  apple_state: 'Session Apple expirée. Réessaie.',
  apple_error: 'Apple a renvoyé une erreur. Réessaie.',
  apple_email: 'Apple n’a pas fourni d’e-mail utilisable.',
  apple_unverified:
    'Cet e-mail a déjà un compte non confirmé. Valide le lien reçu par mail, puis réessaie Apple.',
};

@Component({
  selector: 'app-login-page',
  imports: [NgClass, ReactiveFormsModule, RouterLink, AuthTabs, StoreReviewBypass],
  templateUrl: './login.page.html',
})
export class LoginPage implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly auth = inject(AuthService);
  private readonly biometrics = inject(BiometricAuthService);
  private readonly sessionGate = inject(SessionGate);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly showPassword = signal(false);
  readonly submittedOk = signal(false);
  readonly submitting = signal(false);
  readonly magicSending = signal(false);
  readonly magicSent = signal(false);
  readonly biometricAvailable = signal(false);
  readonly formError = signal<string | null>(null);
  readonly focusedField = signal<string | null>(null);
  readonly storeReviewOk = signal(false);
  readonly showFacebookLogin = this.auth.showFacebookLogin;
  readonly showAppleLogin = this.auth.showAppleLogin;

  readonly form = this.fb.group({
    email: ['', emailValidators],
    password: ['', passwordValidators],
  });

  ngOnInit(): void {
    const oauthError = this.route.snapshot.queryParamMap.get('oauthError');
    if (oauthError) {
      this.formError.set(
        OAUTH_ERROR_COPY[oauthError] ?? 'Connexion sociale impossible. Réessaie.',
      );
    }
    void this.biometrics.isAvailable().then((ok) => this.biometricAvailable.set(ok));
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
          void this.biometrics.rememberLogin(email, password);
          this.submittedOk.set(true);
          const returnUrl = safeInternalPath(this.route.snapshot.queryParamMap.get('returnUrl'));
          void this.router.navigateByUrl(this.auth.postAuthPath(returnUrl));
        },
        error: (err: unknown) => {
          this.formError.set(
            apiErrorMessage(err, 'Email ou mot de passe incorrect. Réessaie.'),
          );
        },
      });
  }

  sendMagicLink(): void {
    this.formError.set(null);
    this.magicSent.set(false);
    this.form.controls.email.markAsTouched();
    if (this.form.controls.email.invalid || this.magicSending()) {
      return;
    }
    this.magicSending.set(true);
    const email = this.form.controls.email.value;
    this.auth
      .requestMagicLink(email)
      .pipe(finalize(() => this.magicSending.set(false)))
      .subscribe({
        next: () => this.magicSent.set(true),
        error: (err: unknown) => {
          this.formError.set(apiErrorMessage(err, 'Envoi du lien impossible. Réessaie.'));
        },
      });
  }

  async unlockWithBiometrics(): Promise<void> {
    this.formError.set(null);
    if (this.auth.getAccessToken()) {
      const verified = await this.biometrics.verifyUnlock();
      if (!verified.ok) {
        if (verified.reason === 'cancelled') {
          return;
        }
        this.formError.set('Biométrie refusée · utilise ton mot de passe.');
        return;
      }
      this.sessionGate.unlock();
      const returnUrl = safeInternalPath(this.route.snapshot.queryParamMap.get('returnUrl'));
      void this.router.navigateByUrl(this.auth.postAuthPath(returnUrl));
      return;
    }

    const result = await this.biometrics.unlock();
    if (!result.ok) {
      if (result.reason === 'cancelled') {
        return;
      }
      if (result.reason === 'empty') {
        this.formError.set('Connecte-toi une fois avec ton mot de passe pour activer Face ID.');
        return;
      }
      this.formError.set('Biométrie indisponible · utilise ton mot de passe ou un lien magique.');
      return;
    }
    this.submitting.set(true);
    this.auth
      .login({ email: result.email, password: result.password })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.submittedOk.set(true);
          const returnUrl = safeInternalPath(this.route.snapshot.queryParamMap.get('returnUrl'));
          void this.router.navigateByUrl(this.auth.postAuthPath(returnUrl));
        },
        error: (err: unknown) => {
          this.formError.set(
            apiErrorMessage(err, 'Session biométrique expirée · reconnecte-toi.'),
          );
        },
      });
  }

  onStoreReviewUnlocked(): void {
    this.storeReviewOk.set(true);
    this.formError.set(null);
  }

  continueWithGoogle(): void {
    this.auth.startGoogleLogin();
  }

  continueWithFacebook(): void {
    this.auth.startFacebookLogin();
  }

  continueWithApple(): void {
    this.auth.startAppleLogin();
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
