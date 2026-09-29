import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const apiBase = environment.apiBaseUrl.replace(/\/$/, '');

function isApiRequest(url: string): boolean {
  return url.startsWith(apiBase) || url.startsWith('/api/');
}

function isAuthCredentialRequest(url: string): boolean {
  return (
    url.includes('/api/v1/auth/login') ||
    url.includes('/api/v1/auth/signup') ||
    url.includes('/api/v1/auth/forgot-password') ||
    url.includes('/api/v1/auth/reset-password')
  );
}

function isEmailUnverifiedError(error: HttpErrorResponse): boolean {
  const body = error.error as { code?: string } | null;
  return error.status === 403 && body?.code === 'E_EMAIL_UNVERIFIED';
}

/**
 * Attaches `Authorization: Bearer <token>` to Adonis API calls.
 * On 401 (except credential endpoints), clears the session and redirects to login.
 * On 403 `E_EMAIL_UNVERIFIED`, keeps the session and sends the user to confirm email.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  const withAuth =
    token && isApiRequest(req.url)
      ? req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        })
      : req;

  return next(withAuth).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && isApiRequest(withAuth.url)) {
        if (isEmailUnverifiedError(error)) {
          auth.handleEmailUnverified();
        } else if (error.status === 401 && !isAuthCredentialRequest(withAuth.url)) {
          auth.handleUnauthorized();
        }
      }
      return throwError(() => error);
    }),
  );
};
