import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import type {
  CollectionItemResponse,
  CollectionListResponse,
  CreateUserBottlePayload,
  FreemiumMeta,
  UpdateUserBottlePayload,
  UserBottle,
} from './cellar.types';

export interface ListCollectionParams {
  category?: string;
  limit?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl.replace(/\/$/, '');

  list(params: ListCollectionParams = {}): Observable<CollectionListResponse> {
    let httpParams = new HttpParams();
    if (params.category) {
      httpParams = httpParams.set('category', params.category);
    }
    if (params.limit) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params.page) {
      httpParams = httpParams.set('page', String(params.page));
    }

    return this.http.get<CollectionListResponse>(`${this.apiBase}/api/v1/collection/bottles`, {
      params: httpParams,
    });
  }

  get(id: number): Observable<CollectionItemResponse> {
    return this.http.get<CollectionItemResponse>(
      `${this.apiBase}/api/v1/collection/bottles/${id}`,
    );
  }

  create(payload: CreateUserBottlePayload): Observable<CollectionItemResponse> {
    return this.http.post<CollectionItemResponse>(
      `${this.apiBase}/api/v1/collection/bottles`,
      payload,
    );
  }

  update(id: number, payload: UpdateUserBottlePayload): Observable<CollectionItemResponse> {
    return this.http.patch<CollectionItemResponse>(
      `${this.apiBase}/api/v1/collection/bottles/${id}`,
      payload,
    );
  }

  delete(id: number): Observable<{ data: { id: number; deleted: boolean }; meta: { freemium: FreemiumMeta } }> {
    return this.http.delete<{
      data: { id: number; deleted: boolean };
      meta: { freemium: FreemiumMeta };
    }>(`${this.apiBase}/api/v1/collection/bottles/${id}`);
  }

  /** Convenience: list then return freemium only. */
  freemium(): Observable<FreemiumMeta> {
    return this.list({ limit: 1 }).pipe(map((body) => body.meta.freemium));
  }

  /** Unwrap data for callers that only need the row. */
  getBottle(id: number): Observable<UserBottle> {
    return this.get(id).pipe(map((body) => body.data));
  }
}
