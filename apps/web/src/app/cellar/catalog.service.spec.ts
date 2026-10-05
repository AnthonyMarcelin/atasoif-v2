import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../environments/environment';
import { CatalogService, looksLikeBarcode } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CatalogService],
    });
    service = TestBed.inject(CatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('looksLikeBarcode accepts 8–14 digits only', () => {
    expect(looksLikeBarcode('50123456')).toBeTrue();
    expect(looksLikeBarcode('50123456789012')).toBeTrue();
    expect(looksLikeBarcode('lagavulin')).toBeFalse();
    expect(looksLikeBarcode('123')).toBeFalse();
  });

  it('returns empty list without calling API when q is blank', () => {
    let data: unknown;
    service.search('  ').subscribe((body) => {
      data = body.data;
    });
    expect(data).toEqual([]);
  });

  it('searches catalog by name', () => {
    service.search('laga').subscribe();
    const req = httpMock.expectOne(
      `${environment.apiBaseUrl}/api/v1/catalog/bottles?limit=20&q=laga`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [] });
  });

  it('loads categories', () => {
    service.categories().subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/catalog/categories`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [{ id: 1, slug: 'whisky', name: 'Whisky' }] });
  });

  it('loads a bottle by id for add-flow prefill', () => {
    service.getById(42).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/catalog/bottles/42`);
    expect(req.request.method).toBe('GET');
    req.flush({
      data: {
        id: 42,
        name: 'Lagavulin 16',
        brand: 'Lagavulin',
        origin: 'Islay',
        abv: 43,
        volumeMl: 700,
        barcode: null,
        photoUrl: null,
        attrs: {},
        categoryId: 1,
        category: { id: 1, slug: 'whisky', name: 'Whisky' },
      },
    });
  });
});
