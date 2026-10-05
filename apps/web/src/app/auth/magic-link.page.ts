import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../core/auth/api-error';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-magic-link-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="auth-page">
      <div class="auth-page__inner">
        <h1 class="auth-title">Lien magique</h1>
        @if (error(); as message) {
          <p class="auth-status auth-status--error" role="alert">{{ message }}</p>
          <a class="auth-btn auth-btn--secondary" routerLink="/auth/login">Retour connexion</a>
        } @else if (ok()) {
          <p class="auth-status auth-status--ok" role="status">C’est bon · on ouvre ta cave.</p>
        } @else {
          <p class="auth-status" role="status">Connexion en cours…</p>
        }
      </div>
    </section>
  `,
})
export class MagicLinkPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly error = signal<string | null>(null);
  readonly ok = signal(false);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
    if (!token) {
      this.error.set('Lien magique incomplet.');
      return;
    }
    this.auth
      .consumeMagicLink(token)
      .pipe(finalize(() => undefined))
      .subscribe({
        next: () => {
          this.ok.set(true);
          void this.router.navigateByUrl(this.auth.postAuthPath('/cave'));
        },
        error: (err: unknown) => {
          this.error.set(apiErrorMessage(err, 'Lien magique invalide ou expiré.'));
        },
      });
  }
}
