import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiDataEnvelope, AuthTokenResponse, AuthUser } from './auth.types';
import {
  readOAuthErrorFromUrl,
  readOAuthTokenFromUrl,
  startNativeOAuthSession,
} from './oauth-session';
import { SessionGate } from './session-gate';
import { TokenStorage } from './token-storage';

export interface SignupPayload {
  email: string;
  password: string;
  passwordConfirmation: string;
  pseudo?: string;
  fullName?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  pseudo: string;
  isPublic: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorage);
  private readonly sessionGate = inject(SessionGate);

  private readonly tokenSignal = signal<string | null>(this.tokenStorage.getToken());
  private readonly userSignal = signal<AuthUser | null>(this.readStoredUser());

  readonly token = this.tokenSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.tokenSignal()));
  readonly isEmailVerified = computed(() => Boolean(this.userSignal()?.emailVerified));

  private readonly apiBase = environment.apiBaseUrl.replace(/\/$/, '');

  getAccessToken(): string | null {
    return this.tokenSignal();
  }

  /** Ally Google OAuth start URL (adds ?client=native on Capacitor). */
  googleAuthUrl(): string {
    return this.allyRedirectUrl('google');
  }

  startGoogleLogin(): void {
    void this.startAllyLogin('google');
  }

  /**
   * When false, login/register hide the Facebook CTA (standby).
   * Ally redirect/callback stay available on the API.
   */
  readonly showFacebookLogin = environment.showFacebookLogin;

  /**
   * When false, login/register hide the Apple CTA.
   * Ally redirect/callback stay available on the API.
   */
  readonly showAppleLogin = environment.showAppleLogin;

  /** Ally Facebook OAuth start URL (adds ?client=native on Capacitor). */
  facebookAuthUrl(): string {
    return this.allyRedirectUrl('facebook');
  }

  startFacebookLogin(): void {
    if (!this.showFacebookLogin) {
      return;
    }
    void this.startAllyLogin('facebook');
  }

  /** Ally Apple OAuth start URL (adds ?client=native on Capacitor). */
  appleAuthUrl(): string {
    return this.allyRedirectUrl('apple');
  }

  startAppleLogin(): void {
    if (!this.showAppleLogin) {
      return;
    }
    void this.startAllyLogin('apple');
  }

  private allyRedirectUrl(provider: 'google' | 'facebook' | 'apple'): string {
    const base = `${this.apiBase}/api/v1/auth/${provider}/redirect`;
    if (!Capacitor.isNativePlatform()) {
      return base;
    }
    const url = new URL(base);
    url.searchParams.set('client', 'native');
    return url.toString();
  }

  /**
   * Native: ASWebAuthenticationSession → custom scheme with #token=.
   * Web: full-page redirect to Ally (FRONTEND_URL handoff).
   */
  private async startAllyLogin(provider: 'google' | 'facebook' | 'apple'): Promise<void> {
    const authorizeUrl = this.allyRedirectUrl(provider);
    if (Capacitor.isNativePlatform()) {
      try {
        const callbackUrl = await startNativeOAuthSession(authorizeUrl);
        if (!callbackUrl) {
          return;
        }
        const oauthError = readOAuthErrorFromUrl(callbackUrl);
        if (oauthError) {
          void this.router.navigate(['/auth/login'], {
            queryParams: { oauthError },
            replaceUrl: true,
          });
          return;
        }
        const token = readOAuthTokenFromUrl(callbackUrl);
        if (!token) {
          void this.router.navigate(['/auth/login'], {
            queryParams: { oauthError: `${provider}_error` },
            replaceUrl: true,
          });
          return;
        }
        this.completeOAuthLogin(token).subscribe({
          next: (user) => {
            if (!user) {
              void this.router.navigate(['/auth/login'], {
                queryParams: { oauthError: `${provider}_error` },
                replaceUrl: true,
              });
              return;
            }
            void this.router.navigateByUrl(this.postAuthPath('/cave'), { replaceUrl: true });
          },
          error: () => {
            void this.router.navigate(['/auth/login'], {
              queryParams: { oauthError: `${provider}_error` },
              replaceUrl: true,
            });
          },
        });
        return;
      } catch {
        // Older TestFlight binary without OAuthSession plugin — Safari + API HTML handoff.
      }
    }
    window.location.assign(authorizeUrl);
  }

  /**
   * Completes the Ally redirect: stores the Bearer token then loads `/account/profile`.
   */
  completeOAuthLogin(token: string): Observable<AuthUser | null> {
    this.tokenSignal.set(token);
    this.tokenStorage.setToken(token);
    this.sessionGate.unlock();
    return this.loadProfile();
  }

  /** Where to land after signup/login: cave only when email is confirmed. */
  postAuthPath(fallback = '/cave'): string {
    return this.isEmailVerified() ? fallback : '/auth/verify-email';
  }

  signup(payload: SignupPayload): Observable<AuthTokenResponse> {
    return this.http
      .post<ApiDataEnvelope<AuthTokenResponse>>(`${this.apiBase}/api/v1/auth/signup`, payload)
      .pipe(
        map((body) => body.data),
        tap((data) => this.persistSession(data.token, data.user)),
      );
  }

  login(payload: LoginPayload): Observable<AuthTokenResponse> {
    return this.http
      .post<ApiDataEnvelope<AuthTokenResponse>>(`${this.apiBase}/api/v1/auth/login`, payload)
      .pipe(
        map((body) => body.data),
        tap((data) => this.persistSession(data.token, data.user)),
      );
  }

  requestMagicLink(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBase}/api/v1/auth/magic-link`, {
      email,
    });
  }

  /**
   * Validates the App Store review secret against the API (`STORE_REVIEW_SECRET`).
   * The secret must never live in the web / Capacitor build.
   */
  validateStoreReview(secret: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.apiBase}/api/v1/auth/store-review`, { secret });
  }

  consumeMagicLink(token: string): Observable<AuthTokenResponse> {
    return this.http
      .post<ApiDataEnvelope<AuthTokenResponse>>(`${this.apiBase}/api/v1/auth/magic-link/consume`, {
        token,
      })
      .pipe(
        map((body) => body.data),
        tap((data) => this.persistSession(data.token, data.user)),
      );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBase}/api/v1/auth/forgot-password`, {
      email,
    });
  }

  verifyEmail(token: string): Observable<AuthUser> {
    return this.http
      .post<ApiDataEnvelope<AuthUser>>(`${this.apiBase}/api/v1/auth/email/verify`, { token })
      .pipe(
        map((body) => body.data),
        tap((user) => {
          if (this.tokenSignal()) {
            this.setUser(user);
          }
        }),
      );
  }

  resendVerificationEmail(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBase}/api/v1/account/email/resend`, {});
  }

  loadProfile(): Observable<AuthUser | null> {
    const token = this.tokenSignal();
    if (!token) {
      return of(null);
    }

    return this.http.get<ApiDataEnvelope<AuthUser>>(`${this.apiBase}/api/v1/account/profile`).pipe(
      map((body) => body.data),
      tap((user) => this.setUser(user)),
      catchError((error: unknown) => {
        // 401 is already handled by the interceptor. Network / 5xx must not drop the token.
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return of(null);
        }
        return of(this.userSignal());
      }),
    );
  }

  updateProfile(payload: UpdateProfilePayload): Observable<AuthUser> {
    return this.http
      .patch<ApiDataEnvelope<AuthUser>>(`${this.apiBase}/api/v1/account/profile`, payload)
      .pipe(
        map((body) => body.data),
        tap((user) => this.setUser(user)),
      );
  }

  logout(): Observable<void> {
    const token = this.tokenSignal();
    if (!token) {
      this.clearSession();
      return of(undefined);
    }

    return this.http.post(`${this.apiBase}/api/v1/account/logout`, {}).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      tap(() => this.clearSession()),
    );
  }

  /**
   * Clears local session and navigates to login.
   * Used by the 401 interceptor — does not call logout (token already invalid).
   */
  handleUnauthorized(returnUrl?: string): void {
    this.clearSession();
    const query = returnUrl ? { queryParams: { returnUrl } } : undefined;
    void this.router.navigate(['/auth/login'], query);
  }

  /** Keeps the session but sends the user to confirm their email. */
  handleEmailUnverified(returnUrl?: string): void {
    const query = returnUrl ? { queryParams: { returnUrl } } : undefined;
    void this.router.navigate(['/auth/verify-email'], query);
  }

  clearSession(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.tokenStorage.clearAll();
    this.sessionGate.unlock();
  }

  private persistSession(token: string, user: AuthUser): void {
    this.tokenSignal.set(token);
    this.userSignal.set(user);
    this.tokenStorage.setToken(token);
    this.tokenStorage.setUserJson(JSON.stringify(user));
    this.sessionGate.unlock();
  }

  private setUser(user: AuthUser): void {
    this.userSignal.set(user);
    this.tokenStorage.setUserJson(JSON.stringify(user));
  }

  private readStoredUser(): AuthUser | null {
    const raw = this.tokenStorage.getUserJson();
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
