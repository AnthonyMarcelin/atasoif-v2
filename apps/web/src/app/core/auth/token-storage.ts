import { Injectable } from '@angular/core';

/**
 * Web MVP token persistence.
 *
 * Strategy (documented for E1-T05):
 * - In-memory cache via AuthService for the active tab session.
 * - `localStorage` so refresh/reopen keeps the Bearer token (Capacitor Secure Storage later).
 * - XSS can still read localStorage; mitigate with CSP + careful HTML, not custom crypto.
 * - Never log the raw token.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private static readonly TOKEN_KEY = 'atasoif.auth.access_token';
  private static readonly USER_KEY = 'atasoif.auth.user';

  getToken(): string | null {
    try {
      return localStorage.getItem(TokenStorage.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    try {
      localStorage.setItem(TokenStorage.TOKEN_KEY, token);
    } catch {
      // Quota / private mode — memory-only fallback handled by AuthService.
    }
  }

  clearToken(): void {
    try {
      localStorage.removeItem(TokenStorage.TOKEN_KEY);
    } catch {
      // ignore
    }
  }

  getUserJson(): string | null {
    try {
      return localStorage.getItem(TokenStorage.USER_KEY);
    } catch {
      return null;
    }
  }

  setUserJson(json: string): void {
    try {
      localStorage.setItem(TokenStorage.USER_KEY, json);
    } catch {
      // ignore
    }
  }

  clearUser(): void {
    try {
      localStorage.removeItem(TokenStorage.USER_KEY);
    } catch {
      // ignore
    }
  }

  clearAll(): void {
    this.clearToken();
    this.clearUser();
  }
}
