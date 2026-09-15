import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiDataEnvelope, AuthTokenResponse, AuthUser } from './auth.types';
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorage);

  private readonly tokenSignal = signal<string | null>(this.tokenStorage.getToken());
  private readonly userSignal = signal<AuthUser | null>(this.readStoredUser());

  readonly token = this.tokenSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.tokenSignal()));

  private readonly apiBase = environment.apiBaseUrl.replace(/\/$/, '');

  getAccessToken(): string | null {
    return this.tokenSignal();
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

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBase}/api/v1/auth/forgot-password`, {
      email,
    });
  }

  loadProfile(): Observable<AuthUser | null> {
    const token = this.tokenSignal();
    if (!token) {
      return of(null);
    }

    return this.http.get<ApiDataEnvelope<AuthUser>>(`${this.apiBase}/api/v1/account/profile`).pipe(
      map((body) => body.data),
      tap((user) => this.setUser(user)),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
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

  clearSession(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.tokenStorage.clearAll();
  }

  private persistSession(token: string, user: AuthUser): void {
    this.tokenSignal.set(token);
    this.userSignal.set(user);
    this.tokenStorage.setToken(token);
    this.tokenStorage.setUserJson(JSON.stringify(user));
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
