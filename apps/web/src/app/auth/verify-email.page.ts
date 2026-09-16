import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../core/auth/api-error';
import { AuthService } from '../core/auth/auth.service';
import { safeInternalPath } from '../core/auth/safe-internal-path';

@Component({
  selector: 'app-verify-email-page',
  imports: [RouterLink],
  templateUrl: './verify-email.page.html',
})
export class VerifyEmailPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly user = this.auth.user;
  readonly verifying = signal(false);
  readonly resending = signal(false);
  readonly verifiedOk = signal(false);
  readonly statusError = signal<string | null>(null);
  readonly resendOk = signal(false);

  ngOnInit(): void {
    if (this.auth.isEmailVerified()) {
      void this.router.navigateByUrl(this.returnUrl());
      return;
    }

    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.confirmWithToken(token);
    }
  }

  resend(): void {
    if (this.resending() || !this.auth.isAuthenticated()) {
      return;
    }
    this.resendOk.set(false);
    this.statusError.set(null);
    this.resending.set(true);
    this.auth
      .resendVerificationEmail()
      .pipe(finalize(() => this.resending.set(false)))
      .subscribe({
        next: () => this.resendOk.set(true),
        error: (err: unknown) => {
          this.statusError.set(
            apiErrorMessage(err, 'Impossible de renvoyer l’e-mail. Réessaie.'),
          );
        },
      });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/auth/login'),
    });
  }

  private confirmWithToken(token: string): void {
    this.verifying.set(true);
    this.statusError.set(null);
    this.auth
      .verifyEmail(token)
      .pipe(finalize(() => this.verifying.set(false)))
      .subscribe({
        next: () => {
          this.verifiedOk.set(true);
          void this.router.navigateByUrl(this.returnUrl());
        },
        error: (err: unknown) => {
          this.statusError.set(
            apiErrorMessage(err, 'Lien de confirmation invalide ou expiré.'),
          );
        },
      });
  }

  private returnUrl(): string {
    return safeInternalPath(this.route.snapshot.queryParamMap.get('returnUrl'));
  }
}
