import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { AuthService } from './auth.service';
import { OAUTH_CALLBACK_SCHEME, readOAuthErrorFromUrl, readOAuthTokenFromUrl } from './oauth-session';

/**
 * Handles OAuth returns that open the app via custom URL scheme
 * (HTML handoff on the API, or system open of fr.atasoif.app://…).
 */
@Injectable({ providedIn: 'root' })
export class OauthDeepLinkService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private started = false;

  async start(): Promise<void> {
    if (this.started || !Capacitor.isNativePlatform()) {
      return;
    }
    this.started = true;
    await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      void this.handleUrl(event.url);
    });
  }

  private async handleUrl(rawUrl: string): Promise<void> {
    if (!rawUrl.startsWith(`${OAUTH_CALLBACK_SCHEME}:`)) {
      return;
    }

    const error = readOAuthErrorFromUrl(rawUrl);
    if (error) {
      void this.router.navigate(['/auth/login'], {
        queryParams: { oauthError: error },
        replaceUrl: true,
      });
      return;
    }

    const token = readOAuthTokenFromUrl(rawUrl);
    if (!token) {
      return;
    }

    this.auth.completeOAuthLogin(token).subscribe({
      next: (user) => {
        if (!user) {
          void this.router.navigate(['/auth/login'], {
            queryParams: { oauthError: 'apple_error' },
            replaceUrl: true,
          });
          return;
        }
        void this.router.navigateByUrl(this.auth.postAuthPath('/cave'), { replaceUrl: true });
      },
      error: () => {
        void this.router.navigate(['/auth/login'], {
          queryParams: { oauthError: 'apple_error' },
          replaceUrl: true,
        });
      },
    });
  }
}
