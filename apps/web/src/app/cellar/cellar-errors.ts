import { HttpErrorResponse } from '@angular/common/http';

import { apiErrorMessage } from '../core/auth/api-error';

export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body = error.error as { code?: string } | null;
  return body && typeof body.code === 'string' ? body.code : null;
}

export function apiErrorFeature(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body = error.error as { feature?: string } | null;
  return body && typeof body.feature === 'string' ? body.feature : null;
}

/** Freemium bottle cap or premium feature deny. */
export function isFreemiumGateError(error: unknown): boolean {
  const code = apiErrorCode(error);
  return code === 'E_BOTTLE_LIMIT' || code === 'E_PREMIUM_REQUIRED';
}

export function cellarErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
