import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, of, type Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import type { ApiDataEnvelope } from '../core/auth/auth.types';
import type { CatalogBottle, CatalogCategory } from './cellar.types';

interface CatalogSearchMeta {
  total?: number;
  perPage?: number;
  currentPage?: number;
  lastPage?: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl.replace(/\/$/, '');

  search(
    q: string,
    limit = 20,
    extras: { category?: string; recentDays?: number; page?: number } = {},
  ): Observable<{ data: CatalogBottle[]; meta?: CatalogSearchMeta }> {
    const trimmed = q.trim();
    if (!trimmed && !extras.category && !extras.recentDays) {
      return of({ data: [] });
    }

    let params = new HttpParams().set('limit', String(limit));
    if (trimmed) {
      params = params.set('q', trimmed);
    }
    if (extras.category) {
      params = params.set('category', extras.category);
    }
    if (extras.recentDays) {
      params = params.set('recentDays', String(extras.recentDays));
    }
    if (extras.page) {
      params = params.set('page', String(extras.page));
    }
    return this.http.get<{ data: CatalogBottle[]; meta?: CatalogSearchMeta }>(
      `${this.apiBase}/api/v1/catalog/bottles`,
      { params },
    );
  }

  lookupBarcode(barcode: string): Observable<CatalogBottle> {
    return this.http
      .get<ApiDataEnvelope<CatalogBottle>>(
        `${this.apiBase}/api/v1/catalog/bottles/barcode/${encodeURIComponent(barcode)}`,
      )
      .pipe(map((body) => body.data));
  }

  categories(): Observable<CatalogCategory[]> {
    return this.http
      .get<ApiDataEnvelope<CatalogCategory[]>>(`${this.apiBase}/api/v1/catalog/categories`)
      .pipe(map((body) => body.data));
  }
}

/** Digits-only barcode length accepted by the API (8–14). */
export function looksLikeBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}
