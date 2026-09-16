import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';

/**
 * Read the OAuth Bearer from the URL fragment (`#token=…`), never from `?token=`.
 * Fragments are not sent to servers in Referer / access logs.
 */
function readOAuthTokenFromHash(): string | null {
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!raw) {
    return null;
  }
  return new URLSearchParams(raw).get('token');
}

function stripOAuthHashFromHistory(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}`);
}

@Component({
  selector: 'app-oauth-callback-page',
  imports: [RouterLink],
  templateUrl: './oauth-callback.page.html',
})
export class OauthCallbackPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const token = readOAuthTokenFromHash();
    stripOAuthHashFromHistory();

    if (!token) {
      this.loading.set(false);
      this.error.set('Connexion sociale incomplète. Réessaie depuis la page de connexion.');
      return;
    }

    this.auth
      .completeOAuthLogin(token)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (user) => {
          if (!user) {
            this.error.set('Impossible de récupérer ton profil. Réessaie.');
            return;
          }
          void this.router.navigateByUrl(this.auth.postAuthPath('/me'), { replaceUrl: true });
        },
        error: () => {
          this.error.set('Impossible de finaliser la connexion sociale. Réessaie.');
        },
      });
  }
}
