import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-oauth-callback-page',
  imports: [RouterLink],
  templateUrl: './oauth-callback.page.html',
})
export class OauthCallbackPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
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
          void this.router.navigateByUrl(this.auth.postAuthPath('/me'));
        },
        error: () => {
          this.error.set('Impossible de finaliser la connexion sociale. Réessaie.');
        },
      });
  }
}
