import { Injectable } from '@angular/core';

import { AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_PERSIST_KEYS } from './persist-keys';
import { persistHydrate, persistRead, persistRemove, persistWrite } from './persistent-kv';

/**
 * Session persistence.
 *
 * - `localStorage` for synchronous AuthService reads after hydrate.
 * - Capacitor Preferences on native (UserDefaults) so iOS does not drop the Bearer
 *   token when WKWebView storage is purged. There is no separate refresh token:
 *   Adonis access tokens last 30 days.
 * - Never log the raw token.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  async hydrate(): Promise<void> {
    await persistHydrate(AUTH_PERSIST_KEYS);
  }

  getToken(): string | null {
    return persistRead(AUTH_TOKEN_KEY);
  }

  setToken(token: string): void {
    persistWrite(AUTH_TOKEN_KEY, token);
  }

  clearToken(): void {
    persistRemove(AUTH_TOKEN_KEY);
  }

  getUserJson(): string | null {
    return persistRead(AUTH_USER_KEY);
  }

  setUserJson(json: string): void {
    persistWrite(AUTH_USER_KEY, json);
  }

  clearUser(): void {
    persistRemove(AUTH_USER_KEY);
  }

  clearAll(): void {
    this.clearToken();
    this.clearUser();
  }
}
