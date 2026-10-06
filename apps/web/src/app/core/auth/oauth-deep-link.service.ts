import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { AuthService } from './auth.service';
import { OAUTH_CALLBACK_SCHEME, readOAuthErrorFromUrl, readOAuthTokenFromUrl } from './oauth-session';

const INVITE_PATH = /^\/?i\/([A-Za-z0-9]{4,16})\/?$/i;

/**
 * Handles custom-scheme opens: OAuth return + invite links (`fr.atasoif.app://i/:code`).
 * Universal Links / Associated Domains are a later step (see CAPACITOR-IOS-TESTFLIGHT.md).
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

    const inviteCode = this.readInviteCode(rawUrl);
    if (inviteCode) {
      void this.router.navigate(['/cave/amis'], {
        queryParams: { invite: inviteCode },
        replaceUrl: true,
      });
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

  private readInviteCode(rawUrl: string): string | null {
    try {
      const url = new URL(rawUrl);
      const path = `${url.host}${url.pathname}`.replace(/^\/+/, '');
      // Custom schemes often parse as host=i, path=/CODE → "i/CODE"
      const match = INVITE_PATH.exec(path.startsWith('i/') ? path : url.pathname);
      return match?.[1]?.toUpperCase() ?? null;
    } catch {
      const bare = rawUrl.match(/:\/\/i\/([A-Za-z0-9]{4,16})/i);
      return bare?.[1]?.toUpperCase() ?? null;
    }
  }
}
