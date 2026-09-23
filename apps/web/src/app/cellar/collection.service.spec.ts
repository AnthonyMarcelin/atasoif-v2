import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../environments/environment';
import { CollectionService } from './collection.service';

describe('CollectionService', () => {
  let service: CollectionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CollectionService],
    });
    service = TestBed.inject(CollectionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists bottles with optional category filter', () => {
    service.list({ category: 'whisky', limit: 20 }).subscribe();
    const req = httpMock.expectOne(
      `${environment.apiBaseUrl}/api/v1/collection/bottles?category=whisky&limit=20`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [],
      meta: { freemium: { count: 0, limit: 10, remaining: 10, entitlement: false } },
    });
  });

  it('creates a cellar entry from catalog hit', () => {
    service.create({ bottleId: 3, boughtAt: 'Nicolas' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/collection/bottles`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ bottleId: 3, boughtAt: 'Nicolas' });
    req.flush({
      data: { id: 1 },
      meta: { freemium: { count: 1, limit: 10, remaining: 9, entitlement: false } },
    });
  });

  it('deletes a cellar entry without resetting the lifetime freemium count', () => {
    service.delete(9).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/collection/bottles/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush({
      data: { id: 9, deleted: true },
      meta: { freemium: { count: 4, limit: 10, remaining: 6, entitlement: false } },
    });
  });

  it('patches fill level without a photo override', () => {
    service.update(4, { fillLevel: 40 }).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/collection/bottles/4`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ fillLevel: 40 });
    req.flush({
      data: { id: 4, fillLevel: 40, fillLevelUpdatesCount: 1 },
      meta: { freemium: { count: 2, limit: 10, remaining: null, entitlement: true } },
    });
  });

  it('uploads a shelf photo as multipart field photo', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'cave.webp', { type: 'image/webp' });
    service.uploadPhoto(4, file).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/collection/bottles/4/photo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    const sent = (req.request.body as FormData).get('photo') as File;
    expect(sent.name).toBe('cave.webp');
    expect(sent.type).toBe('image/webp');
    req.flush({
      data: { id: 4, photoUrlOverride: '/api/v1/collection/bottles/4/photo' },
      meta: { freemium: { count: 2, limit: 10, remaining: null, entitlement: true } },
    });
  });
});
