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
  ): Observable<{ data: CatalogBottle[]; meta?: CatalogSearchMeta }> {
    const trimmed = q.trim();
    if (!trimmed) {
      return of({ data: [] });
    }

    const params = new HttpParams().set('q', trimmed).set('limit', String(limit));
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
