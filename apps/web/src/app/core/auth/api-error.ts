import { HttpErrorResponse } from '@angular/common/http';

/** Prefer Adonis / Vine error messages; fall back to a short FR default. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const body = error.error as
    | {
        message?: string;
        errors?: Array<{ message?: string; field?: string } | string>;
      }
    | string
    | null;

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (body && typeof body === 'object') {
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      const first = body.errors[0];
      if (typeof first === 'string' && first.trim()) {
        return first;
      }
      if (first && typeof first === 'object' && typeof first.message === 'string') {
        return first.message;
      }
    }
  }

  if (error.status === 0) {
    return "Impossible de joindre l'API. Vérifie qu'elle tourne (port 3000).";
  }

  return fallback;
}
